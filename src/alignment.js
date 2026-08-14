// 3-Point Alignment System
// Computes a rigid transform (rotation + translation) from 3 point pairs
import * as THREE from 'three';

const STORAGE_KEY = 'heidentor_alignment_v2';

/**
 * Compute alignment matrix from 3 source points → 3 target points
 * using Kabsch/SVD-free approach (quaternion-based)
 */
export function computeAlignmentMatrix(srcPoints, tgtPoints) {
  if (srcPoints.length !== 3 || tgtPoints.length !== 3) return null;

  // Centroids
  const srcCentroid = new THREE.Vector3();
  const tgtCentroid = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    srcCentroid.add(srcPoints[i]);
    tgtCentroid.add(tgtPoints[i]);
  }
  srcCentroid.divideScalar(3);
  tgtCentroid.divideScalar(3);

  // Centered points
  const srcCentered = srcPoints.map(p => p.clone().sub(srcCentroid));
  const tgtCentered = tgtPoints.map(p => p.clone().sub(tgtCentroid));

  // Compute scale: ratio of RMS distances
  let srcRMS = 0, tgtRMS = 0;
  for (let i = 0; i < 3; i++) {
    srcRMS += srcCentered[i].lengthSq();
    tgtRMS += tgtCentered[i].lengthSq();
  }
  srcRMS = Math.sqrt(srcRMS / 3);
  tgtRMS = Math.sqrt(tgtRMS / 3);
  const scale = srcRMS > 0.0001 ? tgtRMS / srcRMS : 1;

  // Cross-covariance matrix H
  const H = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; i++) {
    const s = srcCentered[i];
    const t = tgtCentered[i];
    H[0][0] += s.x * t.x; H[0][1] += s.x * t.y; H[0][2] += s.x * t.z;
    H[1][0] += s.y * t.x; H[1][1] += s.y * t.y; H[1][2] += s.y * t.z;
    H[2][0] += s.z * t.x; H[2][1] += s.z * t.y; H[2][2] += s.z * t.z;
  }

  // Build rotation from two vector pairs (frame-to-frame)
  // Use edge vectors for robust alignment
  const srcE1 = srcCentered[1].clone().sub(srcCentered[0]).normalize();
  const srcE2 = srcCentered[2].clone().sub(srcCentered[0]).normalize();
  const tgtE1 = tgtCentered[1].clone().sub(tgtCentered[0]).normalize();
  const tgtE2 = tgtCentered[2].clone().sub(tgtCentered[0]).normalize();

  // Orthonormalize
  const srcN = new THREE.Vector3().crossVectors(srcE1, srcE2).normalize();
  const srcE2o = new THREE.Vector3().crossVectors(srcN, srcE1).normalize();

  const tgtN = new THREE.Vector3().crossVectors(tgtE1, tgtE2).normalize();
  const tgtE2o = new THREE.Vector3().crossVectors(tgtN, tgtE1).normalize();

  // Source frame matrix (columns = basis vectors)
  const srcMatrix = new THREE.Matrix4().makeBasis(srcE1, srcE2o, srcN);
  const tgtMatrix = new THREE.Matrix4().makeBasis(tgtE1, tgtE2o, tgtN);

  // Rotation = tgtMatrix * srcMatrix^-1
  const srcInv = srcMatrix.clone().invert();
  const rotMatrix = tgtMatrix.clone().multiply(srcInv);

  // Full transform: translate to origin, rotate, scale, translate to target
  const result = new THREE.Matrix4();
  const T1 = new THREE.Matrix4().makeTranslation(-srcCentroid.x, -srcCentroid.y, -srcCentroid.z);
  const S = new THREE.Matrix4().makeScale(scale, scale, scale);
  const T2 = new THREE.Matrix4().makeTranslation(tgtCentroid.x, tgtCentroid.y, tgtCentroid.z);

  result.copy(T2).multiply(S).multiply(rotMatrix).multiply(T1);
  return result;
}

export function matrixToAlignment(matrix) {
  if (!matrix) return null;
  return {
    reconstructionMatrix: Array.from(matrix.elements)
  };
}

export function alignmentToMatrix(alignment) {
  const arr = Array.isArray(alignment)
    ? alignment
    : alignment?.reconstructionMatrix;

  if (!Array.isArray(arr) || arr.length !== 16) return null;

  const m = new THREE.Matrix4();
  m.fromArray(arr);
  return m;
}

export function saveAlignment(matrix) {
  const arr = matrix.elements;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  localStorage.removeItem('heidentor_force_align');
}

export function loadAlignment(fallbackAlignment = null) {
  if (localStorage.getItem('heidentor_force_align') === 'true') {
    return null;
  }
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return alignmentToMatrix(fallbackAlignment);
  }
  try {
    const arr = JSON.parse(data);
    return alignmentToMatrix(arr);
  } catch {
    return null;
  }
}

export function clearAlignment() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem('heidentor_force_align', 'true');
}
