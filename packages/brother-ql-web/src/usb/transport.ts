// WebUSB transport for Brother QL printers
// Minimal wrapper around navigator.usb with endpoint discovery and read/write helpers.

import { RequestStatus } from "../core/commands";

export class UsbTransport {
  private device: any | null = null;
  private interfaceNumber: number | null = null;
  private endpointIn: number | null = null;
  private endpointOut: number | null = null;

  get isConnected() {
    return !!this.device && this.interfaceNumber !== null && this.endpointIn !== null && this.endpointOut !== null;
  }

  async connect(): Promise<void> {
    const usb: any = (navigator as any).usb;
    if (!usb) throw new Error("WebUSB not available in this browser");

    const device: any = await usb.requestDevice({ filters: [{ vendorId: 0x04f9 }] });
    await device.open();
    if (device.configuration == null) {
      await device.selectConfiguration(1);
    }

    // Find an interface with bulk IN and OUT endpoints
    let chosenInterface: any | null = null;
    let alt: any | null = null;
    for (const iface of device.configuration.interfaces) {
      for (const a of iface.alternates) {
        const hasIn = a.endpoints.some((e: any) => e.direction === "in" && e.type === "bulk");
        const hasOut = a.endpoints.some((e: any) => e.direction === "out" && e.type === "bulk");
        if (hasIn && hasOut) {
          chosenInterface = iface;
          alt = a;
          break;
        }
      }
      if (chosenInterface) break;
    }
    if (!chosenInterface || !alt) throw new Error("Unable to find bulk IN/OUT endpoints");

    await device.claimInterface(chosenInterface.interfaceNumber);
    if (alt.alternateSetting != null) {
      await device.selectAlternateInterface(chosenInterface.interfaceNumber, alt.alternateSetting);
    }

    const epIn = alt.endpoints.find((e: any) => e.direction === "in" && e.type === "bulk");
    const epOut = alt.endpoints.find((e: any) => e.direction === "out" && e.type === "bulk");
    if (!epIn || !epOut) throw new Error("Bulk endpoints not found after claiming interface");

    this.device = device;
    this.interfaceNumber = chosenInterface.interfaceNumber;
    this.endpointIn = epIn.endpointNumber;
    this.endpointOut = epOut.endpointNumber;
  }

  async write(data: any): Promise<void> {
    if (!this.isConnected) throw new Error("Not connected");
    // Normalize to a BufferSource acceptable by WebUSB typings
    const payload =
      data instanceof Uint8Array || data instanceof DataView
        ? (data as ArrayBufferView)
        : data instanceof ArrayBuffer
        ? data
        : (data?.buffer as ArrayBuffer) ?? data;
    const result = await this.device.transferOut(this.endpointOut, payload);
    if (result.status !== "ok") throw new Error(`transferOut failed: ${result.status}`);
  }

  async read(length: number, timeoutMs = 5000): Promise<DataView> {
    if (!this.isConnected) throw new Error("Not connected");
    const p = this.device.transferIn(this.endpointIn, length);
    const race = await Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error("transferIn timeout")), timeoutMs)),
    ]);
    const res = race as { status: string; data: DataView };
    if (res.status !== "ok" || !res.data) throw new Error(`transferIn failed: ${res.status}`);
    return res.data;
  }

  async readStatusFrame(timeoutMs = 5000): Promise<Uint8Array> {
    // Status frames are 32 bytes. To be defensive, loop until filled.
    const total = 32;
    const buf = new Uint8Array(total);
    let off = 0;
    while (off < total) {
      const dv = await this.read(total - off, timeoutMs);
      const chunk = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      buf.set(chunk, off);
      off += chunk.length;
      if (chunk.length === 0) throw new Error("Zero-length read");
    }
    return buf;
  }

  async getStatus(timeoutMs = 5000): Promise<Uint8Array> {
    await this.write(RequestStatus);
    return await this.readStatusFrame(timeoutMs);
  }

  async close(): Promise<void> {
    if (!this.device) return;
    try {
      if (this.interfaceNumber != null) {
        await this.device.releaseInterface(this.interfaceNumber);
      }
    } finally {
      await this.device.close();
      this.device = null;
      this.interfaceNumber = null;
      this.endpointIn = null;
      this.endpointOut = null;
    }
  }
}

export const usbTransport = new UsbTransport();
