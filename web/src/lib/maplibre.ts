// maplibre v6는 워커를 import.meta.url 기준 상대 경로로 찾기 때문에, 번들 후에는 워커 URL을 직접 알려 줘야 한다.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(workerUrl);

export { maplibregl };
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
