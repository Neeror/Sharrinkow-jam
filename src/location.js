export function playerZone(player) {
  if (player.grounded && player.material === 'skin') return 2;
  const p = player.position;
  if (p.x > -3.5 && p.x < 12.5 && p.z > -14 && p.z < 5 && p.y > 1.5) return 1;
  return 0;
}
