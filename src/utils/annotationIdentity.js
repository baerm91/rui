function annotationSignature(annotation) {
  return JSON.stringify({
    ...annotation,
    id: undefined
  });
}

export function preserveDistinctAnnotations(annotations) {
  const usedIds = new Set();
  const signaturesByOriginalId = new Map();

  return annotations.flatMap((annotation, index) => {
    const originalId = annotation.id || `annotation_${index}`;
    const signature = annotationSignature(annotation);
    const knownSignatures = signaturesByOriginalId.get(originalId) ?? new Set();

    if (knownSignatures.has(signature)) return [];

    knownSignatures.add(signature);
    signaturesByOriginalId.set(originalId, knownSignatures);

    let uniqueId = originalId;
    let suffix = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${originalId}_${suffix}`;
      suffix += 1;
    }
    usedIds.add(uniqueId);

    return [{
      ...annotation,
      id: uniqueId
    }];
  });
}
