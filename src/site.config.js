/**
 * Project-specific values live here. The editor and 3D runtime should stay
 * generic so a new exhibition can start with a new config and asset folder.
 */
export const siteConfig = {
  id: 'active-project',
  title: '3D-Projekt',
  subtitle: '',
  watermark: '3D-PROJEKT',
  stationsFile: '/active-project.json',
  downloadFileName: 'project.json',
  storagePrefix: 'three-story',
  models: {
    primary: 'https://starhemberg.vercel.app/model/scene.gltf',
    reconstruction: ''
  }
};
