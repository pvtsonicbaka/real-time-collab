// generates a consistent color from a userId
// same userId always produces same color
export function colorFromId(userId: string): string {
  const hue = parseInt(userId.slice(-6), 16) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
