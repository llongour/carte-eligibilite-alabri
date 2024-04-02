const geocoderApi = {
    forwardGeocode: async (config) => {
      const features = [];
      try {
        const request = `https://api-adresse.data.gouv.fr/search/?q=${config.query}&limit=1`;
        const response = await fetch(request);
        const data = await response.json();
        // Assuming the first result is the most relevant
        const result = data.features[0];
        const point = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [result.geometry.coordinates[0], result.geometry.coordinates[1]],
          },
          place_name: result.properties.label,
          properties: result.properties,
          text: result.properties.label,
          place_type: ["place"],
          center: [result.geometry.coordinates[0], result.geometry.coordinates[1]],
        };
        features.push(point);
      } catch (e) {
        console.error(`Failed to forwardGeocode with error: ${e}`);
      }
  
      return {
        features,
      };
    },
  };
  