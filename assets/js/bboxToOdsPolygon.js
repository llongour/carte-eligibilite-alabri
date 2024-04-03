function bboxToOdsPolygon(bbox) {
    // Extraction des coordonnées depuis la bbox
    const [minLng, minLat, maxLng, maxLat] = bbox;
    
    // Creation de points
    const topLeft = [maxLat, minLng];
    const topRight = [maxLat, maxLng];
    const bottomRight = [minLat, maxLng];
    const bottomLeft = [minLat, minLng];
    
    // Construction de la chaine
    const polygon = `(${topLeft[0]}, ${topLeft[1]}), (${topRight[0]}, ${topRight[1]}), (${bottomRight[0]}, ${bottomRight[1]}), (${bottomLeft[0]}, ${bottomLeft[1]})`;
    
    return polygon;
}