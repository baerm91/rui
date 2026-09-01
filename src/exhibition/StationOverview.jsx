import React from 'react';
import { StationMap } from './MobileStationMap.jsx';
import './stationOverview.css';

export function StationOverview({ title, stations, stationIndex, onOpenStation, onOpenItem, mapViewRef }) {
  return <StationMap title={title} stations={stations} stationIndex={stationIndex} onOpenStation={onOpenStation} onOpenItem={onOpenItem} viewRef={mapViewRef} />;
}
