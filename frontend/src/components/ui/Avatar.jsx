/**
 * components/ui/Avatar.jsx
 *
 * Initials-based colored avatar circle.
 * Derives initials from the first letter of each word in the name (up to 2).
 * Color comes from user.avatar_color — generated deterministically at signup
 * by authService.generateAvatarColor() so it's consistent everywhere.
 *
 * Usage:
 *   <Avatar name="Aisha Sharma" color="#6366f1" size="md" />
 *   <Avatar name="Rohan"        color="#8b5cf6" size="sm" />
 *
 * Sizes: xs (24px) | sm (32px) | md (40px) | lg (48px) | xl (64px)
 */

const SIZE_CLASSES = {
  xs: 'w-6  h-6  text-[10px]',
  sm: 'w-8  h-8  text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  // First letter of first + last word
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, color = '#6366f1', size = 'md', className = '' }) {
  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center
                  font-semibold text-white flex-shrink-0 select-none ${className}`}
      style={{ backgroundColor: color }}
      aria-label={`Avatar for ${name}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
