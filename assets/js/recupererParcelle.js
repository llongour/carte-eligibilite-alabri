function recupererParcelle(lat, lng) {
    const cadApiUrl = `https://data.strasbourg.eu/api/records/1.0/search/?dataset=parcelles_cadastrales&q=&geofilter.distance=${lat}%2C${lng}%2C1`;
  
    return fetch(cadApiUrl)
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