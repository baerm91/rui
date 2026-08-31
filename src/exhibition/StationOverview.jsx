import React from 'react';
import { StationMap } from './MobileStationMap.jsx';
import './stationOverview.css';

export function StationOverview({ title, stations, stationIndex, onOpenStation, mapViewRef }) {
  return <StationMap title={title} stations={stations} stationIndex={stationIndex} onOpenStation={onOpenStation} viewRef={mapViewRef} />;
}
