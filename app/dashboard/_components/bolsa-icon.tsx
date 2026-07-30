import {
  Wallet,
  PiggyBank,
  Briefcase,
  Home,
  Car,
  Plane,
  Gift,
  Heart,
  Gem,
  Coffee,
  Book,
  Sparkles,
  Users,
  LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  briefcase: Briefcase,
  home: Home,
  car: Car,
  plane: Plane,
  gift: Gift,
  heart: Heart,
  gem: Gem,
  coffee: Coffee,
  book: Book,
  sparkles: Sparkles,
  users: Users,
};

export function BolsaIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = (name && ICON_MAP[name]) || Wallet;
  return <Icon className={className ?? "h-5 w-5"} />;
}

export const BOLSA_ICONS_LIST = Object.keys(ICON_MAP);
