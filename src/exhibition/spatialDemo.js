import { createSpatialItem, normalizeSpatialStation } from '../utils/spatialStory.js';
import { createCuratedSpatialSurfaceMaterials } from '../utils/spatialMaterials.js';

const models = [
  {
    title: 'Beschädigter Helm',
    description: 'Ein materialreiches PBR-Beispiel für die direkte glTF-Darstellung im Raum.',
    modelUrl: 'https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf',
    thumbnailUrl: 'https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/Default_albedo.jpg',
    attribution: 'Leonardo Carrion / Khronos glTF Sample Models', license: 'CC BY-NC 4.0'
  },
  {
    title: 'Ente', description: 'Direkt geladenes glTF-Sample mit eigener Modelltransformation.',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF/Duck.gltf',
    thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/screenshot/screenshot.png',
    attribution: 'Sony / Khronos', license: 'SCEA Shared Source License'
  },
  {
    title: 'Avocado', description: 'Ein weiteres reales Objekt derselben kuratierten Station.',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF/Avocado.gltf',
    thumbnailUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/screenshot/screenshot.jpg',
    attribution: 'Microsoft / Khronos', license: 'CC BY 4.0'
  }
];

const makeStation = (index, title, introduction, itemOffset = 0) => ({
  id: `spatial-demo-${index + 1}`,
  title,
  description: introduction,
  introduction,
  spatial: {
    ...normalizeSpatialStation({ spatial: { surfaceMaterials: createCuratedSpatialSurfaceMaterials() } }, index),
    position: [index * 9, 0, index % 2 ? -1.5 : 0],
    camera: { position: [index * 9, 1.8, 7], target: [index * 9, 1.5, 0], fov: 45 }
  },
  items: models.slice(itemOffset, itemOffset + (index === 0 ? 3 : 1)).map((model, modelIndex) => createSpatialItem({
    ...model,
    id: `demo-${index}-${modelIndex}`,
    thumbnailTransform: { position: [-2 + modelIndex * 1.7, 1.35, .08], scale: .9 },
    modelTransform: {
      position: [1.35, .18, .55],
      rotation: [0, model.title === 'Ente' ? -.42 : .35, 0],
      scale: model.title === 'Ente' ? .78 : model.title === 'Avocado' ? .88 : .94
    }
  }, modelIndex)),
  selectedItemId: `demo-${index}-0`
});

export const SPATIAL_DEMO_STORY = {
  id: 'spatial-dev-preview',
  name: 'Material und Erinnerung',
  description: 'Eine räumliche Story über Form, Oberfläche und digitale Bewahrung.',
  settings: { experienceType: 'room' },
  models: { primary: '' },
  stations: [
    makeStation(0, 'Spuren auf der Oberfläche', 'Drei digitale Objekte eröffnen unterschiedliche Blicke auf Material, Gebrauch und Rekonstruktion.'),
    makeStation(1, 'Form in Bewegung', 'Die zweite Station setzt den Rundgang mit einem einzelnen Fokusobjekt fort.', 1),
    makeStation(2, 'Bewahren und Weitergeben', 'Am Ende des Raums wird das digitale Objekt zum Träger einer neuen Erzählung.', 2)
  ]
};
