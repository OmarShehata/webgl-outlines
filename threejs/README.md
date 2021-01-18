# Rendering outlines in ThreeJS

* Source for article (LINK) in ThreejS.
* To run this `npm install` and `npm run dev`.
* Run `npm run build` to get a static folder to host.
* The shader code is in `CustomOutlinePass.js`
* Caveats
	* There's some debug code in there for rendering normals/depth. 
	* Would be more efficient by getting the normal buffer from the engine