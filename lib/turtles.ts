export const turtleVariants = [
  {
    id: "clover",
    image: "/assets/turtles/clover.png?v=2",
    label: "Clover",
  },
  {
    id: "pebble",
    image: "/assets/turtles/pebble.png?v=2",
    label: "Pebble",
  },
  {
    id: "marina",
    image: "/assets/turtles/marina.png?v=2",
    label: "Marina",
  },
  {
    id: "rosie",
    image: "/assets/turtles/rosie.png?v=2",
    label: "Rosie",
  },
] as const;

export type TurtleVariant = (typeof turtleVariants)[number]["id"];

export const defaultTurtleVariant: TurtleVariant = "clover";

export function getTurtleImage(variant: TurtleVariant) {
  return turtleVariants.find((turtle) => turtle.id === variant)?.image ??
    turtleVariants[0].image;
}

export function isTurtleVariant(value: unknown): value is TurtleVariant {
  return turtleVariants.some((turtle) => turtle.id === value);
}
