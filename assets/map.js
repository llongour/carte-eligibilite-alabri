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

const bounds = [
  [7.1521, 48.109265],
  [8.344116, 48.9694],
];

const map = new maplibregl.Map({
  container: "map",
  style: {
    'version': 8,
    'sources': {
        'raster-tiles': {
            'type': 'raster',
            'tiles': [
                'https://adict.strasbourg.eu/mapproxy/service?VERSION=1.1.0&1=2&SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=monstrasbourg&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=false&HEIGHT=256&WIDTH=256&SRS=EPSG%3A3857&BBOX={bbox-epsg-3857}'
            ],
            'tileSize': 256
        }
    },
    'layers': [
        {
            'id': 'simple-tiles',
            'type': 'raster',
            'source': 'raster-tiles',
            'minzoom': 0,
            'maxzoom': 22
        }
    ]
},
  minZoom: 10,
  center: [7.7254, 48.5798],
  hash: true,
  maxBounds: bounds,
});

map.dragRotate.disable();

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

  map.addSource("papizorn", {
    type: "geojson",
    data: "assets/papi_zorn.geojson",
  });

  map.addLayer({
    id: "papizorn-layer",
    type: "fill",
    source: "papizorn",
    paint: {
      "fill-color": "orange",
      "fill-opacity": 0,
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
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
});

map.on("click", function (e) {
  const featuresMasque = map.queryRenderedFeatures(e.point, {
    layers: ["masque-layer"],
  });

  if (featuresMasque.length > 0) {
    return;
  }

  const featuresPapiZorn = map.queryRenderedFeatures(e.point, {
    layers: ["papizorn-layer"],
  });

  var coordinates = e.lngLat;

  if (featuresPapiZorn.length > 0) {
    const lat = coordinates.lat;
    const lon = coordinates.lng;
    const rnApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=ppri-zonage-rn&q=&geofilter.distance=${lat}%2C${lon}%2C1`;
    const ipdApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=ppri-zonage-ipd&q=&geofilter.distance=${lat}%2C${lon}%2C1`;
    const cadApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=parcelles_cadastrales&q=&geofilter.distance=${lat}%2C${lon}%2C1`;

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
        popupMessage += `<br>Zone gérée par le SDEA<br><a href="https://www.strasbourg.eu/risque-inondation" target="_blank">Plus d'informations sur l'opération Pieds au sec</a>`;
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

    return;
  }

  const lat = coordinates.lat;
  const lon = coordinates.lng;
  const rnApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=ppri-zonage-rn&q=&geofilter.distance=${lat}%2C${lon}%2C1`;
  const ipdApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=ppri-zonage-ipd&q=&geofilter.distance=${lat}%2C${lon}%2C1`;
  const cadApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=parcelles_cadastrales&q=&geofilter.distance=${lat}%2C${lon}%2C1`;

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
