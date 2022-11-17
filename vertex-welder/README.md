# Vertex Welder

This is an example app that "welds" vertices together given an angle thershold, to generate models that will have clean outlines when rendered with the [surface ID outline post process](https://omar-shehata.medium.com/better-outline-rendering-using-surface-ids-with-webgl-e13cdab1fd94).

Before & after:

![](/media/welder_before_after.png)

### Live demo

https://omarshehata.me/html/vertex-welder/

The video below shows how to use this demo with the [Tugboat.glb](https://github.com/OmarShehata/webgl-outlines/blob/main/threejs/public/Tugboat.glb) model to weld its vertices with an angle threshold of 3 degrees & download the welded model. 

https://user-images.githubusercontent.com/1711126/202502478-66b9d75d-a643-4fe9-ba06-f2c8b1fef772.mp4

### Using it in your own project

All the welding code is in [VerticesWelder.js](src/VerticesWelder.js). It has no dependencies so you can use this file with other engines outside of ThreeJS.

It takes a vertex buffer, index buffer, and an angle threshold, and returns a new index buffer.

```javascript
import { weldVertices } from "./VerticesWelder.js";

const indexBuffer = [i1, i2, i3, ...]
const vertexBuffer = [
	v0_x, v0_y, v0_z,
	v1_x, v1_y, v1_z,
	v2_x, v2_y, v2_z,
]
const angleInDegrees = 2;

const newIndexBuffer = new weldVertices(vertexBuffer, indexBuffer, angleInDegrees);
```

The `newIndexBuffer` will have the same number of triangles as the input index buffer, but it will be using fewer vertices.

### How it works

The `weldVertices()` function checks every edge in every triangle. It compares the angle between the current triangle and its sibling along the current edge. If the angle is greater than the threshold angle, the vertices in the current edge and its sibling edge are merged.

_Note: when I say "compare angle between triangles" I mean compare the face normals of the triangles._

The example below shows concretely how this works. On the left is the original mesh. 

![](/media/welder_simple_annotated.png)

Consider the 2 triangles:

```
3, 18, 5
14, 17, 4
```

The angle between is small, so the edge `[18, 5]` is merged with `[17, 4]`. You can see in the image on the right that the vertices 17 & 4 are no longer there. The new index buffer still contains these 2 triangles, but they are now listed like this:

```
3, 18, 5
14, 18, 5
```

The fact that `18` & `5` are now shared vertices between these 2 triangles allows us to consider them both part of the same "surface" & correct draw no outline between them in the [surface ID outline technique](https://omar-shehata.medium.com/better-outline-rendering-using-surface-ids-with-webgl-e13cdab1fd94).

Another way to think about what the `weldVertices()` function does is that it's basically a wrapper around ThreeJS's [EdgesGeometry](https://threejs.org/docs/#api/en/geometries/EdgesGeometry). Whereas `EdgesGeometry` looks over every triangle & its siblings and returns a list of edges, `weldVertices()` goes further. It takes those edges that should have an outline and ensures they are using shared vertices. The reason you'd want to do this over just drawing the edges directly is because a post process effect renders much more efficiently for models with many lines.

### Caveats

* This app assumes that your model does NOT have a vertex `color` attributes. 
  * This is because we store the `surfaceId` in the color attribute. If your model does have vertex colors they will be discarded/overwritten.
* Merging vertices means other vertex data may be lost, most commonly texture coordinates.
* `weldVertices()` only removes vertices, it does not add any new edges. This means if there is a piece of the model with a sharp curve that _should_ be outlined, but isn't because the triangles share vertices, then this script will not fix it.
  * I ignore this because I think it's a rare case — if your geometry looks like this then your normals aren't as expected for correct rendering/lighting.

The loss of the texture coordinates is the biggest drawback to this automated approach. Ideally what you'd want to do is create this merged index buffer, and use that version of the model to draw outlines, but render the original model intact. That would give you clean, crisp outlines without messing up the original model, at the expense of having multiple versions of the model at runtime.
