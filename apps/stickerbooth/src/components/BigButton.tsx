import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export function BigButton({ children, variant = 'primary', onClick, ...rest }: PropsWithChildren<Props>) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    // Prevent default to avoid mouse events on mobile
    if (!rest.disabled) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!rest.disabled && onClick) {
      // Create a synthetic mouse event for onClick
      const syntheticEvent = {
        ...e,
        type: 'click',
        button: 0,
        buttons: 1,
        preventDefault: e.preventDefault.bind(e),
        stopPropagation: e.stopPropagation.bind(e),
      } as any;
      onClick(syntheticEvent);
    }
  };

  return (
    <button
      {...rest}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
