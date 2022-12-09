Object.assign(pc, function () {
    var OutlineEffect = function (graphicsDevice, normalsTexture, options) {
        pc.PostEffect.call(this, graphicsDevice);
        
        this.normalsTexture = normalsTexture;
        this.outlineOnly = options.outlineOnly;

        var color = options.outlineColor;
        this.outlineColor = [color.r, color.g, color.b];
        // Packing 4 parameters into one uniform: 
        this.multiplierParameters = [
          options.depthBias,
          options.depthMultiplier, 
          options.normalBias, 
          options.normalMultiplier
        ];

        this.needsDepthBuffer = true;
        this.shader = new pc.Shader(graphicsDevice, {
            attributes: {
                aPosition: pc.SEMANTIC_POSITION
            },
            vshader: `
            attribute vec2 aPosition;
            varying vec2 vUv0;

            void main(void)
            {
                gl_Position = vec4(aPosition, 0.0, 1.0);
                vUv0 = (aPosition.xy + 1.0) * 0.5;
            }
            `,
            fshader:
                `
                precision ${graphicsDevice.precision} float;
                ${graphicsDevice.webgl2 ? '#define GL2' : ""}
                ${pc.shaderChunks.screenDepthPS}

                varying vec2 vUv0;
                uniform sampler2D uColorBuffer;
                uniform sampler2D uNormalBuffer;
                uniform bool uOutlineOnly;
                uniform vec4 uMultiplierParameters;
                uniform vec3 uOutlineColor;

                // Helper functions for reading normals and depth of neighboring pixels.
                float getPixelDepth(float x, float y) {
                    // uScreenSize.zw is pixel size 
                    // vUv0 is current position
                    return getLinearScreenDepth(vUv0 + uScreenSize.zw * vec2(x, y));
                }
                vec3 getPixelNormal(int x, int y) {
                    return texture2D(uNormalBuffer, vUv0 + uScreenSize.zw * vec2(x, y)).rgb;
                }
                float saturateValue(float num) {
                    return clamp(num, 0.0, 1.0);
                }

                void main()
                {
                    // Color, depth, and normal for current pixel.
                    vec4 sceneColor = texture2D( uColorBuffer, vUv0 );
                    float depth = getPixelDepth(0.0, 0.0);
                    vec3 normal = getPixelNormal(0, 0);

                    // Get the difference between depth of neighboring pixels and current.
                    float depthDiff = 0.0;
                    depthDiff += abs(depth - getPixelDepth(1.0, 0.0));
                    depthDiff += abs(depth - getPixelDepth(-1.0, 0.0));
                    depthDiff += abs(depth - getPixelDepth(0.0, 1.0));
                    depthDiff += abs(depth - getPixelDepth(0.0, -1.0));

                    // Get the difference between normals of neighboring pixels and current
                    float normalDiff = 0.0;
                    normalDiff += distance(normal, getPixelNormal(1, 0));
                    normalDiff += distance(normal, getPixelNormal(0, 1));
                    normalDiff += distance(normal, getPixelNormal(0, 1));
                    normalDiff += distance(normal, getPixelNormal(0, -1));

                    normalDiff += distance(normal, getPixelNormal(1, 1));
                    normalDiff += distance(normal, getPixelNormal(1, -1));
                    normalDiff += distance(normal, getPixelNormal(-1, 1));
                    normalDiff += distance(normal, getPixelNormal(-1, -1));

                    // Apply multiplier & bias to each 
                    float depthBias = uMultiplierParameters.x;
                    float depthMultiplier = uMultiplierParameters.y;
                    float normalBias = uMultiplierParameters.z;
                    float normalMultiplier = uMultiplierParameters.w;

                    depthDiff = depthDiff * depthMultiplier;
                    depthDiff = saturateValue(depthDiff);
                    depthDiff = pow(depthDiff, depthBias);

                    normalDiff = normalDiff * normalMultiplier;
                    normalDiff = saturateValue(normalDiff);
                    normalDiff = pow(normalDiff, normalBias);

                    float outline = normalDiff + depthDiff;
                    
                    // Combine outline with scene color.
                    vec4 outlineColor = vec4(uOutlineColor, 1.0);
                    gl_FragColor = vec4(mix(sceneColor, outlineColor, outline));

                    if (uOutlineOnly) {
                        gl_FragColor = vec4(vec3(uOutlineColor * outline), 1.0);
                    }

                    // Uncomment to debug draw either the normal buffer  
                    // or the depth buffer.
                    //gl_FragColor = vec4(normal, 1.0);
                    //gl_FragColor = vec4(vec3(depth * 0.0005), 1.0);
                    //gl_FragColor = vec4(vec3(depthMultiplier), 1.0);
                }`
        });
    };

    OutlineEffect.prototype = Object.create(pc.PostEffect.prototype);
    OutlineEffect.prototype.constructor = OutlineEffect;

    Object.assign(OutlineEffect.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            // This contains the scene color.
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            // This is the scene re-rendered with a normal material on every mesh.
            scope.resolve("uNormalBuffer").setValue(this.normalsTexture);
            
            // Parameters for styling this effect. 
            scope.resolve("uOutlineOnly").setValue(this.outlineOnly);
            scope.resolve("uMultiplierParameters").setValue(this.multiplierParameters);
            scope.resolve("uOutlineColor").setValue(this.outlineColor);

            pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        OutlineEffect: OutlineEffect
    };
}());