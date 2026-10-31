export function repairBedFabric(model) {
  const bottom = model.getObjectByName('cover_cover_bottom_0');
  if (!bottom) return;
  bottom.material = bottom.material.clone();
  bottom.material.depthWrite = false;
  bottom.renderOrder = -1;
}
