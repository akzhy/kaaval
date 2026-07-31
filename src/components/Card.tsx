import type { PropsWithChildren } from "react";
import { css } from "@flairjs/client";

type CardProps = PropsWithChildren<{
  className?: string;
  dashed?: boolean;
}>;

function Card({ children, className, dashed }: CardProps) {
  const classes = dashed ? "card card-dashed" : "card";
  return (
    <div className={className ? `${classes} ${className}` : classes}>
      {children}
    </div>
  );
}

Card.flair = css`
  .card {
    background-color: $colors.surface-bright;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 16px;
  }

  .card-dashed {
    background-color: transparent;
    border: 1px dashed $colors.border;
  }
`;

export default Card;
