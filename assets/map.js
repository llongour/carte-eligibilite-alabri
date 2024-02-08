function geojsonGeometryToPlainText(geojsonGeometry) {
  if (geojsonGeometry.type !== 'Polygon' && geojsonGeometry.type !== 'MultiPolygon') {
    return 'Input is not a Polygon or MultiPolygon';
  }

  const coordinates = geojsonGeometry.coordinates.map(ring => {
    const formattedRing = ring.map(([lon, lat]) => `(${lat}, ${lon})`).join(', ');
    return formattedRing;
  });

  return coordinates.join(', ');
}

  

const fetchZonageRn = (apiUrl) => {
  return fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      const filteredRecords = data.records.filter((record) => {
        const nom = record.fields.nom.toLowerCase();
        return nom === "zone verte" || nom === "zone vert claire";
      });
      if (
        filteredRecords.length > 0 &&
        filteredRecords[0].fields.soumisalea === "oui"
      ) {
        return true;
      } else {
        return false;
      }
    })
    .catch((error) => {
      console.error(
        "Une erreur s'est produite lors de la récupération des données JSON :",
        error
      );
      return false;
    });
};

const fetchZonageIpd = (apiUrl) => {
  return fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      if (
        data.records &&
        data.records.length > 0 &&
        data.records[0].fields.soumisalea === "oui"
      ) {
        return true;
      } else {
        return false;
      }
    })
    .catch((error) => {
      console.error(
        "Une erreur s'est produite lors de la récupération des données JSON :",
        error
      );
      return false;
    });
};

function fetchParcelle(apiUrl) {
  return fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      if (data.records && data.records.length > 0) {
        const parcelleId = data.records[0].fields.id_parcellaire;
        const parcelleGeo = data.records[0].fields.geo_shape;
        return { id_parcellaire: parcelleId, geo_shape: parcelleGeo };
      } else {
        return "N/A";
      }
    })
    .catch((error) => {
      console.error(
        "Une erreur s'est produite lors de la récupération des données du cadastre :",
        error
      );
      return "N/A";
    });
}

const geocoderApi = {
  forwardGeocode: async (config) => {
    const features = [];
    try {
      const request = `https://nominatim.openstreetmap.org/search?q=${config.query}&format=geojson&polygon_geojson=1&addressdetails=1`;
      const response = await fetch(request);
      const geojson = await response.json();
      for (const feature of geojson.features) {
        const center = [
          feature.bbox[0] + (feature.bbox[2] - feature.bbox[0]) / 2,
          feature.bbox[1] + (feature.bbox[3] - feature.bbox[1]) / 2,
        ];
        const point = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: center,
          },
          place_name: feature.properties.display_name,
          properties: feature.properties,
          text: feature.properties.display_name,
          place_type: ["place"],
          center,
        };
        features.push(point);
      }
    } catch (e) {
      console.error(`Failed to forwardGeocode with error: ${e}`);
    }

    return {
      features,
    };
  },
};

const bounds = [
  [7.1521, 48.109265],
  [8.344116, 48.9694],
];

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  minZoom: 10,
  center: [7.7254, 48.5798],
  hash: true,
  maxBounds: bounds,
});

map.on("load", () => {
  map.addSource("masque", {
    type: "geojson",
    data: "assets/masque.geojson",
  });

  map.addLayer({
    id: "masque-layer",
    type: "fill",
    source: "masque",
    paint: {
      "fill-color": "grey",
      "fill-opacity": 0.5,
    },
  });

  map.addSource("parcel-source", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "parcel-layer",
    type: "fill",
    source: "parcel-source",
    paint: {
      "fill-color": "blue",
      "fill-opacity": 0.3,
    },
  });

  map.addControl(
    new MaplibreGeocoder(geocoderApi, {
      maplibregl,
    })
  );

  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
    })
  );

  map.addControl(new maplibregl.FullscreenControl());
  map.addControl(new maplibregl.NavigationControl());
});

map.on("click", function (e) {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ["masque-layer"],
  });

  if (features.length > 0) {
    return;
  }

  var coordinates = e.lngLat;

  const lat = coordinates.lat;
  const lon = coordinates.lng;
  const rnApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=ppri-zonage-rn&q=&geofilter.distance=${lat}%2C${lon}%2C1`;
  const ipdApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=ppri-zonage-ipd&q=&geofilter.distance=${lat}%2C${lon}%2C1`;
  const cadApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=parcelles_cadastrales&q=&geofilter.distance=${lat}%2C${lon}%2C1`;

  fetchParcelle(cadApiUrl)
    .then((parcelleData) => {
      if (parcelleData.geo_shape) {
        const plainTextGeometry = geojsonGeometryToPlainText(
          parcelleData.geo_shape
        );
        console.log("Plain Text Geometry:", plainTextGeometry);
      } else {
        console.log("No geometry data available.");
      }
    })
    .catch((error) => {
      console.error("An error occurred while fetching parcelle data:", error);
    });

  Promise.all([
    fetchZonageRn(rnApiUrl),
    fetchZonageIpd(ipdApiUrl),
    fetchParcelle(cadApiUrl),
  ]).then((results) => {
    const eligible = results.includes(true);
    const cadastreData = results[2];
    const parcelleId = cadastreData.id_parcellaire
      ? cadastreData.id_parcellaire
      : "N/A";
    const message = eligible
      ? "<b>Votre bien est localisé en zone inondable</b>"
      : "<b>Votre bien n'est pas identifié en zone inondable</b>";
    let popupMessage = `${message}<br>Parcelle : ${parcelleId}`;

    if (eligible) {
      popupMessage += `<br><a href="https://www.strasbourg.eu/404" target="_blank">M'inscrire pour un diagnostic ALABRI gratuit</a>`;
    }
    popupMessage +=
      '<br><a href="https://www.strasbourg.eu/risque-inondation" target="_blank">Plus d\'informations sur le risque inondation</a>';
    if (!eligible) {
      popupMessage +=
        '<br><a href="https://www.strasbourg.eu/prevenir-inondations-caves-sous-sols" target="_blank">Prévenir les inondations des sous-sols</a>';
    }

    new maplibregl.Popup()
      .setLngLat(coordinates)
      .setHTML(popupMessage)
      .addTo(map);

    if (cadastreData.geo_shape) {
      map.getSource("parcel-source").setData(cadastreData.geo_shape);
    } else {
      map
        .getSource("parcel-source")
        .setData({ type: "FeatureCollection", features: [] });
    }
  });
});
