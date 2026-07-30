import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserAvatar({
  nombre,
  email,
  avatarUrl,
}: {
  nombre: string;
  email: string;
  avatarUrl: string | null;
}) {
  const inicial = (nombre?.[0] ?? email?.[0] ?? "?").toUpperCase();
  return (
    <div className="flex items-center gap-2 pl-1">
      <Avatar className="h-8 w-8">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={nombre} />}
        <AvatarFallback>{inicial}</AvatarFallback>
      </Avatar>
      <div className="hidden text-right md:block">
        <p className="text-xs font-medium leading-tight">{nombre}</p>
        <p className="text-[10px] leading-tight text-muted-foreground">{email}</p>
      </div>
    </div>
  );
}
