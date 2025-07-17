import React, { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import csv2geojson from "csv2geojson";
import "./styles/map.css";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/150_jKcyV6n6ZVh14MqR4wbc2Wt2cgWLN1lIg-ChB5GM/gviz/tq?tqx=out:csv&sheet=Sheet1";

const MapComponent: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style:
        "https://api.maptiler.com/maps/openstreetmap/style.json?key=niKRdWmY2vN9CkvNZJMu",
      center: [-123.248423, 49.264235],
      zoom: 13,
    });

    mapRef.current = map;

    map.on("load", async () => {
      try {
        const csvText = await fetch(CSV_URL).then((res) => res.text());

        // Split lines and get headers
        const lines = csvText.trim().split("\n");
        const headers = lines[0].split(",").map(h =>
            h.replace(/^"(.*)"$/, "$1").trim()
        );
        console.log(headers)
        const targetIndex = headers.indexOf("Longitude");

        // Check if column exists
        if (targetIndex === -1) {
          throw new Error(`Column "Longitude" not found in headers`);
        }

        // Filter lines: keep header + rows where target column is not empty
        const filteredLines = [
          lines[0],
          ...lines.slice(1).filter((line) => {
            const values = line.split(",");
            return values[targetIndex]?.trim() !== "";
          }),
        ];

        // Join back into filtered CSV text
        const filteredCsvText = filteredLines.join("\n");

        csv2geojson.csv2geojson(
          filteredCsvText,
          {
            latfield: "Latitude",
            lonfield: "Longitude",
            delimiter: ",",
          },
          async (err, data) => {
            if (err || !data) {
              console.error("Failed to parse CSV:", err);
              return;
            }

            const result = await map.loadImage(
              "https://img.icons8.com/color/48/place-marker--v1.png"
            );
            const image = result.data;

            if (!map.hasImage("icon")) {
              map.addImage("icon", image);
            }

            map.addLayer({
              id: "csvData",
              type: "symbol",
              source: {
                type: "geojson",
                data: data as GeoJSON.FeatureCollection,
              },
              layout: {
                "icon-image": "icon",
                "icon-anchor": "center",
                "icon-allow-overlap": true,
                "icon-size": 0.5,
              },
            });

            map.on("click", "csvData", (e) => {
              const feature = e.features?.[0];
              if (!feature || feature.geometry.type !== "Point") return;

              const coordinates = feature.geometry.coordinates.slice() as [
                number,
                number
              ];
              const props = feature.properties || {};

              const popupHTML = `
                <h3>${props["Study Spot"]}</h3>

              `;

              new Popup().setLngLat(coordinates).setHTML(popupHTML).addTo(map);
            });

            const bounds = turf.bbox(data as GeoJSON.FeatureCollection);
            map.fitBounds(bounds as [number, number, number, number], {
              padding: 50,
            });

            // Click anywhere to highlight nearest microwave
            map.on("click", (e) => {
              const clickedPoint = turf.point([e.lngLat.lng, e.lngLat.lat]);
              const features = map.queryRenderedFeatures({
                layers: ["csvData"],
              });

              const featurePoints = features
                .filter((f) => f.geometry.type === "Point")
                .map((f) =>
                  turf.point((f.geometry as GeoJSON.Point).coordinates)
                );

              if (featurePoints.length === 0) return;

              const nearest = turf.nearestPoint(
                clickedPoint,
                turf.featureCollection(featurePoints)
              );

              if (map.getLayer("nearest-circle")) {
                map.removeLayer("nearest-circle");
                map.removeSource("nearest-circle");
              }

              map.addLayer(
                {
                  id: "nearest-circle",
                  type: "circle",
                  source: {
                    type: "geojson",
                    data: {
                      type: "Feature",
                      geometry: nearest.geometry,
                      properties: {},
                    },
                  },
                  paint: {
                    "circle-radius": 16,
                    "circle-color": "#FCC419",
                  },
                },
                "csvData"
              );
            });
          }
        );
      } catch (err) {
        console.error("Error during map setup:", err);
      }
    });

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: "100%",
        height: "100vh",
      }}
    />
  );
};

export default MapComponent;
