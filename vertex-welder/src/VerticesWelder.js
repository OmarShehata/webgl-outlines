/**
 * Merges together vertices along the edges between triangles
 * whose angle is below the given threshold.
 *
 * @param {number[]} vertices - Array of (x,y,z) positions as a flat list.
 * @param {number[]} indices - Array of indices of (v1, v2, v3) that define the triangles.
 * @param {number} [thresholdAngle=1] - In degrees. When the angle between the face normals
 *  of 2 triangles is less than this threshold, the vertices along their shared edge are merged.
 * @returns {number[]} - A new index buffer without the extra vertices.
 */
function weldVertices(vertices, indices, thresholdAngle = 1) {
  const newIndices = [];
  const ignoredIndices = {};
  const mergedMap = {};
  const vertexAliases = {};

  // Helper function to mark 2 vertices as merged
  function merge(i1, i2) {
    if (mergedMap[i1] == undefined) mergedMap[i1] = [];

    mergedMap[i1].push(i2);
  }
  // Marks a given edge as deleted, and which one it's replaced by
  function aliasDeletedVertex(deletedVertex, remainingVertex) {
    if (deletedVertex == remainingVertex) return;

    vertexAliases[deletedVertex] = remainingVertex;
  }

  // `computeEdgesToMerge` looks over all the geometry and returns an array of edges that should be merged
  const edgesToMerge = computeEdgesToMerge(vertices, indices, thresholdAngle);
  // Convert the array of edges to merge to a map
  const edgesToMergeMap = {};
  for (let i = 0; i < edgesToMerge.length; i++) {
    const edgesList = edgesToMerge[i];
    for (let index of edgesList) {
      edgesToMergeMap[index] = edgesList;
    }
  }

  // Go through all triangles
  for (let i = 0; i < indices.length; i += 3) {
    // Look at all 3 edges
    const i1 = indices[i + 0];
    const i2 = indices[i + 1];
    const i3 = indices[i + 2];
    const edges = [];
    edges.push([i1, i2]);
    edges.push([i1, i3]);
    edges.push([i2, i3]);
    for (let edge of edges) {
      let index0 = edge[0];
      let index1 = edge[1];
      const reverseEdge = [index1, index0];
      let isReverse = false;

      // Check if this edge exists in the "merge map"
      let edgeToMerge;
      if (edgesToMergeMap[edge]) {
        edgeToMerge = edge;
      }
      if (edgesToMergeMap[reverseEdge]) {
        edgeToMerge = reverseEdge;
        isReverse = true;
      }

      if (edgeToMerge) {
        // Once you found an edge to merge,
        // you need to find its sibling edge, then merge the vertices in the right orientation
        // edgesToMergeMap[edge] contains two edges
        const possibleEdge1 = edgesToMergeMap[edgeToMerge][0];
        const possibleEdge2 = edgesToMergeMap[edgeToMerge][1];
        let otherEdge = possibleEdge1;
        let originalEdge = possibleEdge2;
        // Just pick the one that is NOT the current edgeToMerge
        if (
          (possibleEdge1[0] == index0 && possibleEdge1[1] == index1) ||
          (possibleEdge1[0] == index1 && possibleEdge1[1] == index0)
        ) {
          otherEdge = possibleEdge2;
          originalEdge = possibleEdge1;
        }

        let index2 = otherEdge[0];
        let index3 = otherEdge[1];
        index0 = originalEdge[0];
        index1 = originalEdge[1];

        if (index0 == index2 && index1 == index3) {
          // Not sure why this happens, but sometimes
          // you get these degenerate self edges
          continue;
        }

        // Merge index0 and index1, with index2 & 3
        // Figure out which orientation to merge in
        // if you have:
        //  1 ---- 2
        //  3 ----- 4
        // You want to merge 1,3, and 2,4
        // NOT the other way around
        const v0 = getVertexFromIndexBuffer(index0, vertices);
        const v2 = getVertexFromIndexBuffer(index2, vertices);
        if (v0.distanceTo(v2) > 0.1) {
          let tmp = index3;
          index3 = index2;
          index2 = tmp;
        }

        // Replace deleted indices
        if (vertexAliases[index0]) index0 = vertexAliases[index0];
        if (vertexAliases[index1]) index1 = vertexAliases[index1];
        if (vertexAliases[index2]) index2 = vertexAliases[index2];
        if (vertexAliases[index3]) index3 = vertexAliases[index3];

        merge(index0, index2);
        merge(index1, index3);
        // 0 was merged with 2, so we consider 2 the deleted vertex
        aliasDeletedVertex(index2, index0);
        aliasDeletedVertex(index3, index1);

        // Remove them edges we've merged from the map
        const mergedEdge = [index2, index3];
        delete edgesToMergeMap[edgeToMerge];
        delete edgesToMergeMap[mergedEdge];
      }
    }
  }

  const finalMergeMap = fillOutMergeMap(mergedMap);

  /* 
    Go through the original index buffer
    replace indices with the merged indices
    
    So if you had the following 2 triangles
    
  
      [0, 1, 2] & [3, 4, 5]

    And the merge map tells you the following vertices are merged together:
    	3 -> 1
    	4 -> 2

    Then you want to replace 3 with 1 whenever you see it, etc.
    So the new buffer is:

      [0, 1, 2] & [1, 2, 5]

    */
  const newIndexBuffer = [];
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    let newIndex = index;
    if (finalMergeMap[index] != undefined) {
      newIndex = finalMergeMap[index];
    }

    newIndexBuffer.push(newIndex);
  }

  return newIndexBuffer;
}

function getVertexFromIndexBuffer(index, positionAttr) {
  return new Vector3(
    positionAttr[index * 3 + 0],
    positionAttr[index * 3 + 1],
    positionAttr[index * 3 + 2]
  );
}

function fillOutMergeMap(mergeMap) {
  /*
    If your map looks like this:

    0: [1, 2, 3]

    This creates entries for 1, 2, 3 so that they are all replaced with 0

    So the result looks like this:
  
    0: [1, 2, 3],
    1: [0],
    2: [0],
    3: [0],
    */
  const newMergeMap = {};
  for (let i = 0; i < Object.keys(mergeMap).length; i++) {
    const key = Object.keys(mergeMap)[i]; // 0
    const indices = mergeMap[key]; // [1, 2, 3]
    for (let ind of indices) {
      newMergeMap[ind] = Number(key);
    }
  }

  return newMergeMap;
}

// Based on ThreeJS class
class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  distanceTo(v) {
    const dx = this.x - v.x,
      dy = this.y - v.y,
      dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;

    return this;
  }

  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;

    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    return this.crossVectors(this, v);
  }

  crossVectors(a, b) {
    const ax = a.x,
      ay = a.y,
      az = a.z;
    const bx = b.x,
      by = b.y,
      bz = b.z;

    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
}

// Code below is adapted from ThreeJS EdgesGeometry
// https://github.com/mrdoob/three.js/blob/dev/src/geometries/EdgesGeometry.js
const _v0 = new Vector3();
const _v1 = new Vector3();
const _normal = new Vector3();
let _triangle = [];
const precisionPoints = 4;
const precision = Math.pow(10, precisionPoints);

function hashVertex(v) {
  return `${Math.round(v.x * precision)},${Math.round(
    v.y * precision
  )},${Math.round(v.z * precision)}`;
}

function getNormal(a, b, c, resultNormal) {
  resultNormal.subVectors(c, b);
  _v0.subVectors(a, b);
  resultNormal.cross(_v0);

  const targetLengthSq = resultNormal.lengthSq();
  if (targetLengthSq > 0) {
    return resultNormal.multiplyScalar(1 / Math.sqrt(targetLengthSq));
  }

  return resultNormal.set(0, 0, 0);
}

function computeEdgesToMerge(vertices, indices, thresholdAngle = 1) {
  const DEG2RAD = Math.PI / 180;
  const thresholdDot = Math.cos(DEG2RAD * thresholdAngle);

  const indexCount = indices.length;

  const indexArr = [0, 0, 0];
  const vertKeys = ["a", "b", "c"];
  const hashes = new Array(3);

  const edgeData = {};
  const edgesToMerge = [];

  for (let i = 0; i < indexCount; i += 3) {
    indexArr[0] = indices[i];
    indexArr[1] = indices[i + 1];
    indexArr[2] = indices[i + 2];

    const a = getVertexFromIndexBuffer(indexArr[0], vertices);
    const b = getVertexFromIndexBuffer(indexArr[1], vertices);
    const c = getVertexFromIndexBuffer(indexArr[2], vertices);

    getNormal(a, b, c, _normal);

    _triangle = [a, b, c];

    // create hashes for the edge from the vertices
    hashes[0] = hashVertex(a);
    hashes[1] = hashVertex(b);
    hashes[2] = hashVertex(c);

    // skip degenerate triangles
    if (
      hashes[0] === hashes[1] ||
      hashes[1] === hashes[2] ||
      hashes[2] === hashes[0]
    ) {
      continue;
    }

    // iterate over every edge
    for (let j = 0; j < 3; j++) {
      // get the first and next vertex making up the edge
      const jNext = (j + 1) % 3;
      const vecHash0 = hashes[j];
      const vecHash1 = hashes[jNext];
      const v0 = _triangle[vertKeys[j]];
      const v1 = _triangle[vertKeys[jNext]];

      const hash = `${vecHash0}_${vecHash1}`;
      const reverseHash = `${vecHash1}_${vecHash0}`;

      const indexHash = `${indexArr[j]}_${indexArr[jNext]}`;
      const indexReverseHash = `${indexArr[jNext]}_${indexArr[j]}`;

      if (reverseHash in edgeData && edgeData[reverseHash]) {
        // if we found a sibling edge add it into the vertex array if
        // it meets the angle threshold and delete the edge from the map.
        if (_normal.dot(edgeData[reverseHash].normal) > thresholdDot) {
          // Merge these two edges if they are separate
          let edge1 = [
            edgeData[reverseHash].index0,
            edgeData[reverseHash].index1,
          ];
          let edge2 = [indexArr[j], indexArr[jNext]];

          edgesToMerge.push([edge1, edge2]);
        }
        edgeData[reverseHash] = null;
      } else if (!(hash in edgeData)) {
        // if we've already got an edge here then skip adding a new one
        edgeData[hash] = {
          index0: indexArr[j],
          index1: indexArr[jNext],
          normal: _normal.clone(),
        };
      }
    }
  }

  return edgesToMerge;
}

export { weldVertices };
