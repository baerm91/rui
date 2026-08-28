import { Euler, Vector3 } from 'three';

export function resolveWallBackgroundSide(spatial = {}, showOverview = false) {
  if (showOverview) return 1;
  const wallNormal = new Vector3(0, 0, 1)
    .applyEuler(new Euler().fromArray(spatial.rotation || [0, 0, 0]));
  const cameraDirection = new Vector3()
    .fromArray(spatial.camera?.position || [0, 0, 1])
    .sub(new Vector3().fromArray(spatial.position || [0, 0, 0]));
  return wallNormal.dot(cameraDirection) < 0 ? -1 : 1;
}
