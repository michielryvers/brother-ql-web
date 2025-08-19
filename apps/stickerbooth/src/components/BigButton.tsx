import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger';
};

export function BigButton({ children, variant = 'primary', ...rest }: PropsWithChildren<Props>) {
  return (
    <button
      {...rest}
      className={[
        'sb-bigbtn',
        variant === 'primary' ? 'sb-bigbtn-primary' : 'sb-bigbtn-danger',
        rest.className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}

export default BigButton;
