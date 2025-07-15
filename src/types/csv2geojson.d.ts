declare module 'csv2geojson' {
    const csv2geojson: {
      csv2geojson: (
        csv: string,
        options: {
          latfield?: string;
          lonfield?: string;
          delimiter?: string;
        },
        callback: (error: Error | null, data: GeoJSON.FeatureCollection) => void
      ) => void;
    };
  
    export default csv2geojson;
  }
  