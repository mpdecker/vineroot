import { clsx } from 'clsx';

const colors = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-purple-500',
  'bg-pink-500',
];

function getColorByName(name: string): string {
  const hash = name.charCodeAt(0);
  return colors[hash % colors.length];
}

interface AvatarProps {
  name?: string;
  url?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function Avatar({ name, url, size = 'md' }: AvatarProps) {
  const sizeClass = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  }[size];

  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  if (url) {
    return <img src={url} alt={name} className={clsx(sizeClass, 'rounded-full object-cover')} />;
  }

  return (
    <div
      className={clsx(
        sizeClass,
        getColorByName(name || ''),
        'rounded-full flex items-center justify-center text-white font-semibold'
      )}
    >
      {initials}
    </div>
  );
}
