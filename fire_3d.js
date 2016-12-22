//http://learningwebgl.com/blog/?p=28

var gl;
var shaderProgram;
var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

var lastTime = 0;

function initGL(canvas){
	try{
		var displayWidth = canvas.clientWidth;
		var displayHeight = canvas.clientHeight;

		if(canvas.width != displayWidth || canvas.height != displayHeight) {
			canvas.width = displayWidth;
			canvas.height = displayHeight;
		}
		gl = canvas.getContext("experimental-webgl");
		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;
	} catch(e) {
		console.log(e);
	}
	if(!gl) {
		alert("Sorry, not working");
	} else {
		var extensions = gl.getSupportedExtensions();

		console.log(gl);
		console.log(extensions);
	}
}

function getShader(gl, id){
	var shaderScript = document.getElementById(id);

	if(!shaderScript){
		return null;
	}

	var str ='';
	var k = shaderScript.firstChild;
	while(k){
		if(k.nodeType == 3){
			str += k.textContent;
		}
		k = k.nextSibling;
	}

	var shader;
	if(shaderScript.type == "x-shader/x-fragment"){
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if(shaderScript.type == "x-shader/x-vertex"){
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}

	gl.shaderSource(shader, str);
	gl.compileShader(shader);

	if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
		console.log("wrong in getShader")
		alert(gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}

function initShaders(){
	var fragmentShader = getShader(gl, "shader-fs");
	var vertexShader =  getShader(gl, "shader-vs");

	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if(!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		console.log("wrong in initShader")
		alert("Couldn't initialise shaders");
	}

	gl.useProgram(shaderProgram);
	//reference to position attribute
	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
	//reference to color attribute
	shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
	gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
	shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
	shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
	shaderProgram.colorUniform = gl.getUniformLocation(shaderProgram, "uColor");
	shaderProgram.opacityUniform = gl.getUniformLocation(shaderProgram, "uOpacity");
	shaderProgram.smokeUniform = gl.getUniformLocation(shaderProgram, "smoke");
}

function handleLoadedTexture(texture){
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	gl.bindTexture(gl.TEXTURE_2D, null);
}

var particleTexture;
function initTexture(){
	particleTexture = gl.createTexture();
	particleTexture.image = new Image();
	particleTexture.image.onload = function(){
		handleLoadedTexture(particleTexture);
	}

	particleTexture.image.src = "./circle.gif";
}

function mvPushMatrix(){
	var copy = mat4.create();
	mat4.set(mvMatrix, copy);
	mvMatrixStack.push(copy);
}

function mvPopMatrix(){
	if(mvMatrixStack.length == 0){
		throw "invalid popMatrix";
	}
	mvMatrix = mvMatrixStack.pop();
}

function degToRad(degrees){
	return degrees * Math.PI / 180;
}

function setMatrixUniforms(){
	gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
	gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

var zoom = -20;

var particleVertexPositionBuffer;
var particleVertexTextureCoordBuffer;
var floorVertexPositionBuffer;
var floorVetexTextureCoordBuffer;
function initBuffers(){
	//PARTICLES
	particleVertexPositionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, particleVertexPositionBuffer);
	var vertices = [-1 , -1, 0.0,
				1, -1, 0.0,
				-1, 1, 0.0,
				1, 1, 0.0];

	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	particleVertexPositionBuffer.itemSize = 3;
	particleVertexPositionBuffer.numItems = 4;

	particleVertexTextureCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, particleVertexTextureCoordBuffer);
	var textureCoords = [0.0, 0.0,
						1.0, 0.0,
						0.0, 1.0,
						1.0, 1.0];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
	particleVertexTextureCoordBuffer.itemSize = 2;
	particleVertexTextureCoordBuffer.numItems = 4;

	//FLOOR
	floorVertexPositionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, floorVertexPositionBuffer);
	var floor = [
             5.0, 0.0, 5.0,
            -5.0, 0.0, 5.0,
             5.0, 0.0, -5.0,
            -5.0, 0.0, -5.0,
        ];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(floor), gl.STATIC_DRAW);
	floorVertexPositionBuffer.itemSize = 3;
	floorVertexPositionBuffer.numItems = 4;
}

function drawFloor(){
	
	gl.uniform3f(shaderProgram.colorUniform, 0.5, 0.5, 0.5); //gray floor
	gl.uniform1f(shaderProgram.opacityUniform, 1.0);
	gl.uniform1f(shaderProgram.smokeUniform, 1.0); //no texture added

	gl.bindBuffer(gl.ARRAY_BUFFER, floorVertexPositionBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexAttribPointer, floorVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

	setMatrixUniforms();
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, floorVertexPositionBuffer.numItems);
}

//draw both fire and smoke particles
function drawParticle(){
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, particleTexture);
	gl.uniform1i(shaderProgram.samplerUniform, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, particleVertexTextureCoordBuffer);
	gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, particleVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, particleVertexPositionBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, particleVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

	setMatrixUniforms();
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, particleVertexPositionBuffer.numItems);
}

var effectiveFPMS = 60/1000;

var max = 60;
var min = 10;

Particle.prototype.animate = function(elapsedTime){
	this.y += 0.01 * effectiveFPMS * elapsedTime;
	this.life -= 0.2;

	//will start over by a reset
	this.g = Math.max(0.2, this.life / max);
	
	this.a = Math.min(0.2, this.life / max - 0.1);

	this.x += Math.cos(Math.random()*2 * Math.PI)*effectiveFPMS;
	this.z += Math.cos(Math.random()*2 * Math.PI)*effectiveFPMS;

	//dead - reset
	if(this.life < 0.0){
		this.y = -4;
		this.x = Math.random()*4 - 2;
		this.z = Math.random()*2*Math.sqrt(4 - Math.pow(this.x, 2)) - Math.sqrt(4 - Math.pow(this.x, 2));
		this.life = Math.random()*60;
		this.r = 0.7;
		this.b = 0.0;
		this.smoke = false;
	}
};

Particle.prototype.draw = function(){
	mvPushMatrix();
	//first rotate to face the viewer and then translate the particle to right place
	mat4.translate(mvMatrix, [this.x, this.y, this.z]);
	mat4.rotate(mvMatrix, degToRad(-rFloor), [0.0, 1.0, 0.0]);

	//set color  and opacity
	gl.uniform3f(shaderProgram.colorUniform, this.r, this.g, this.b);
	gl.uniform1f(shaderProgram.opacityUniform, this.a);
	gl.uniform1f(shaderProgram.smokeUniform, 0.0);
	drawParticle();

	mvPopMatrix();
};

//starting values for particles
function Particle(x, z){
	this.r = 1.0;
	this.a = 0.3;
	this.y = -4.0;
	this.x = x;
	this.z = z;
	this.life = Math.random()*60;
	this.smoke = false;
}

SmokeParticle.prototype.animate = function(elapsedTime){
	this.y += 0.01 * effectiveFPMS * elapsedTime;
	this.life -= 0.1;
	
	this.a = Math.min(0.2, this.life / max - 0.1);

	this.x += Math.cos(Math.random()*2 * Math.PI)*effectiveFPMS;
	this.z += Math.cos(Math.random()*2 * Math.PI)*effectiveFPMS;

	if(this.life < 0.0){
		this.y = -(Math.random()*2 + 2);
		this.x = Math.random()*4 - 2;
		this.z = Math.random()*2*Math.sqrt(4 - Math.pow(this.x, 2)) - Math.sqrt(4 - Math.pow(this.x, 2));
		this.life = Math.random()*60;
	}
};

SmokeParticle.prototype.draw = function(){
	mvPushMatrix();
	//first rotate to face the viewer and then translate the particle to right place
	mat4.translate(mvMatrix, [this.x, this.y, this.z]);
	mat4.rotate(mvMatrix, degToRad(-rFloor), [0.0, 1.0, 0.0]);

	//set color  and opacity
	gl.uniform3f(shaderProgram.colorUniform, this.r, this.g, this.b);
	gl.uniform1f(shaderProgram.opacityUniform, this.a);
	gl.uniform1f(shaderProgram.smokeUniform, 0.0);
	drawParticle();

	mvPopMatrix();
};

function SmokeParticle(x, y, z){
	this.r = 0.35;
	this.g = 0.35;
	this.b = 0.35;
	this.a = 1.0;
	this.y = y;
	this.x = x;
	this.z = z;
	this.life = Math.random()*60;
}

var particles = [];
var smokeParticles = [];
function initWorldObjects(){
	var numParticles = 10000;

	//create particles
	for(var i = 0; i < numParticles; i++){
		var x = Math.random()*4 - 2;
		var z = Math.random()*2*Math.sqrt(4 - Math.pow(x, 2)) - Math.sqrt(4 - Math.pow(x, 2));
		particles.push(new Particle(x, z));
		if(i < numParticles/3){
			x = Math.random()*4 - 2;
			var y = -(Math.random()*2 + 2);
			z = Math.random()*2*Math.sqrt(4 - Math.pow(x, 2)) - Math.sqrt(4 - Math.pow(x, 2));
			smokeParticles.push(new SmokeParticle(x, y, z));
		}
	}
}

var rFloor = 0;
function drawScene(){
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	mat4.perspective(45, gl.viewportWidth/gl.viewportHeight, 0.1, 100.0, pMatrix);

	mat4.identity(mvMatrix);
	mat4.translate(mvMatrix, [0.0, 0.0, zoom]);
	mat4.rotate(mvMatrix, degToRad(rFloor), [0.0, 1.0, 0.0]);

	mvPushMatrix();
	//move and rotate particle
	mat4.translate(mvMatrix, [0.0, -4.0, 0.0]);

	drawFloor();

	mvPopMatrix();
	

	for(var i in smokeParticles){
		smokeParticles[i].draw();
	}

	

	for(var i in particles){
		particles[i].draw();
	}

	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
	gl.enable(gl.BLEND);
}

var elapsed = 0;
function animate(){
	var timeNow = new Date().getTime();
	if(lastTime != 0){
		elapsed = timeNow - lastTime;

		rFloor += (10 * elapsed) / 1000.0;

		// make each particle move
		for(var i in particles){
			particles[i].animate(elapsed);
		}
		for(var i in smokeParticles){
			smokeParticles[i].animate(elapsed);
		}
	}
	lastTime = timeNow;
}

function tick(){
	requestAnimFrame(tick);
	drawScene();
	animate();
}

// the first function to be called
function webGLStart(){
	console.log("fire");

	var canvas = document.getElementById("gl");

	//initialise WebGL
	initGL(canvas);
	initShaders();
	initBuffers(); //hold the details of the triangle and the square
	initTexture();
	initWorldObjects();

	//background
	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	tick();
}