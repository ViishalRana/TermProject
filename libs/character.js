import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from '../libs/PointerLockControls.js';

var scale = chroma.scale(['blue','green','red']).domain([0,MAX_HEIGHT]);
var MAX_HEIGHT = 25;
var cx,cy,cz;
var is_cheat=false;
var is_win=false;
var victorysound;
var dancesound;
var sound;


class CharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};


class CharacterController {
  constructor(params) {
    this.init(params);
  }

  init(params) {
    this._params = params;
    this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this._acceleration = new THREE.Vector3(1, 0.25, 50.0);
    this._velocity = new THREE.Vector3(0, 0, 0);

    this._animations = {};
    this.input = new CharacterControllerInput();
    this.charstate = new DiffCharacterStates(
      new CharacterControllerProxy(this._animations));

    this.LoadModels();
  }

  LoadModels() {
    const loader = new FBXLoader();
    loader.setPath('../assets/models/character/');
    loader.load('girl.fbx', (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });

      this._target = fbx;
      this._target.position.set(0,0,-350);
      this._position=this._target.position;
      this._params.scene.add(this._target);

      this._mixer = new THREE.AnimationMixer(this._target);

      this._manager = new THREE.LoadingManager();
      this._manager.onLoad = () => {
        this.charstate.setState('idle');
      };

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = this._mixer.clipAction(clip);

        this._animations[animName] = {
          clip: clip,
          action: action,
        };
      };

      const loader = new FBXLoader(this._manager);
      loader.setPath('../assets/models/character/');
      loader.load('walk.fbx', (a) => { _OnLoad('walk', a); });
      loader.load('run.fbx', (a) => { _OnLoad('run', a); });
      loader.load('idle.fbx', (a) => { _OnLoad('idle', a); });
      loader.load('dance.fbx', (a) => { _OnLoad('dance', a); });
      loader.load('jump.fbx', (a) => { _OnLoad('jump', a); });

    });
  }

  Update(timeInSeconds) {
    if (!this._target) {
      return;
    }

    this.charstate.Update(timeInSeconds, this.input);

    const velocity = this._velocity;
    const frameDecceleration = new THREE.Vector3(
      velocity.x * this._decceleration.x,
      velocity.y * this._decceleration.y,
      velocity.z * this._decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
      Math.abs(frameDecceleration.z), Math.abs(velocity.z));

    velocity.add(frameDecceleration);

    const controlObject = this._target;
    const _Q = new THREE.Quaternion();
    const _A = new THREE.Vector3();
    const _R = controlObject.quaternion.clone();
    this._rotation=_R;
    // console.log(_R);

    const acc = this._acceleration.clone();
    if (this.input._keys.shift) {
      acc.multiplyScalar(2.0);
    }

    if (this.input._keys.space) {
      acc.multiplyScalar(0.0);
    }
    
    if (this.input._keys.forward) {
      velocity.z += acc.z * timeInSeconds;
    }
    if (this.input._keys.backward) {
      velocity.z -= acc.z * timeInSeconds;
    }
    if (this.input._keys.jump) {
      velocity.y += acc.z * timeInSeconds;
    }
    if (this.input._keys.left) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);

      _R.multiply(_Q);
    }
    if (this.input._keys.right) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
      //console.log(_Q);
      _R.multiply(_Q);
    }

    controlObject.quaternion.copy(_R);

    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();

    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();

    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);

    controlObject.position.add(forward);
    controlObject.position.add(sideways);

    oldPosition.copy(controlObject.position);

    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }
  }
};


//keybord input for walk,run,jump,dance,etc
class CharacterControllerInput {
  constructor() {
    this.init();
  }

  init() {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
      jump:false
    };
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  }

  _onKeyDown(event) {
    switch (event.keyCode) {
      case 38: // up arrow
        this._keys.forward = true;
        break;
      case 37: // left arrow
        this._keys.left = true;
        break;
      case 40: // down arrow
        this._keys.backward = true;
        break;
      case 39: // right arrow
        this._keys.right = true;
        break;
      case 32: // SPACE
        this._keys.space = true;
        dancesound.play();
        break;
      case 16: // SHIFT
        this._keys.shift = true;
        break;
      case 74: //j
        this._keys.jump = true;
        // console.log("jumpppp");
        break;
    }
  }

  _onKeyUp(event) {
    switch (event.keyCode) {
      case 38: // up arrow
        this._keys.forward = false;
        break;
      case 37: // left arrow
        this._keys.left = false;
        break;
      case 40: // down arrow
        this._keys.backward = false;
        break;
      case 39: // right arrow
        this._keys.right = false;
        break;
      case 32: // SPACE
        this._keys.space = false;
        break;
      case 16: // SHIFT
        this._keys.shift = false;
        break;
      case 74: //j
        this._keys.jump = false;
        // console.log("pppppppumj");
        break;
    }
  }
};


//charcter will update everytime character has some movement
class CharacterState {
  constructor() {
    this.states = {};
    this.currentState = null;
  }

  //add the new state
  addState(name, type) {
    this.states[name] = type;
  }

  //first exiting previous state and then will set the current state
  setState(name) {
    const prevState = this.currentState;

    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      else {
        prevState.Exit(); //exiting previous state
      }
    }

    const state = new this.states[name](this);

    this.currentState = state;
    state.Enter(prevState); //notify the new/current state that is active
  }

  //updates function gets called every frame and passes 
  //the frame time and input to the current and the active state

  Update(timeElapsed, input) {
    if (this.currentState) {
      this.currentState.Update(timeElapsed, input);
    }
  }
};



class DiffCharacterStates extends CharacterState {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this.init();
  }

  init() {
    //passing the name of the state and then it will
    //get intantiated to represent that state
    this.addState('idle', IdleState);
    this.addState('walk', WalkState);
    this.addState('run', RunState);
    this.addState('dance', DanceState);
    this.addState('jump', JumpState);
  }
};


class State {
  constructor(parent) {
    this._parent = parent;
  }

  Enter() { }
  Exit() { }
  Update() { }
};


class DanceState extends State {
  constructor(parent) {
    super(parent);

    this._FinishedCallback = () => {
      this._Finished();
    }
  }

  get Name() {
    return 'dance';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['dance'].action;
    const mixer = curAction.getMixer();
    //set an event listener to wait till its finished
    //once it's done we state back to idle
    mixer.addEventListener('finished', this._FinishedCallback);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.reset();
      curAction.setLoop(THREE.LoopOnce, 1); //1 because we want to play this only once
      curAction.clampWhenFinished = true; //pause the animation when it's done 
      curAction.crossFadeFrom(prevAction, 0.2, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  _Finished() {
    this._Cleanup();
    this._parent.setState('idle');
  }

  _Cleanup() {
    const action = this._parent._proxy._animations['dance'].action;

    action.getMixer().removeEventListener('finished', this._CleanupCallback);
  }

  Exit() {
    this._Cleanup();
  }

  //it's doesn't do any update coz it's just plays and exits
  Update(_) {
  }
};


class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['walk'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      //if prevstate is running we want to enter into walking smoothly
      //because of legs placement
      //so what we do is set walking animation delay with same % as running animation
      if (prevState.Name == 'run') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  //check if model is still walking else in idle
  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      //shift key is pressed set to run state
      if (input._keys.shift) {
        this._parent.setState('run');
      }
      return;
    }

    this._parent.setState('idle');
  }
};


class JumpState extends State {
  constructor(parent) {
    super(parent);

    this._FinishedCallback = () => {
      this._Finished();
    }
  }

  get Name() {
    return 'jump';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['jump'].action;
    const mixer = curAction.getMixer();
    //set an event listener to wait till its finished
    //once it's done we state back to idle
    mixer.addEventListener('finished', this._FinishedCallback);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.reset();
      curAction.setLoop(THREE.LoopOnce, 1); //1 because we want to play this only once
      curAction.clampWhenFinished = true; //pause the animation when it's done 
      curAction.crossFadeFrom(prevAction, 0.2, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  _Finished() {
    this._Cleanup();
    this._parent.setState('idle');
  }

  _Cleanup() {
    const action = this._parent._proxy._animations['jump'].action;

    action.getMixer().removeEventListener('finished', this._CleanupCallback);
  }

  Exit() {
    this._Cleanup();
  }

  //it's doesn't do any update coz it's just plays and exits
  Update(_) {
  }
};




//same as runstate
class RunState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'run';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['run'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'walk') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      // if not pressing the shift key back to walk
      if (!input._keys.shift) {
        this._parent.setState('walk');
      }
      return;
    }

    this._parent.setState('idle');
  }
};


class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle'].action;

    //we are fading out the prev state and activating the new state
    //i.e if character is walking and now we want character to run 
    //we are fading the walking state and activating running state
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  Update(_, input) {
    //if character moving forward or backward we set the state to walk
    if (input._keys.forward || input._keys.backward) {
      this._parent.setState('walk');
    }
    //else if space we set it to dance
    else if (input._keys.space) {
      this._parent.setState('dance');
    }
  }

};



class SetCharacterSetup {
  constructor() {
    this.initializinSetup();
  }

  initializinSetup() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    });

    //this is set up for desplaying in screen
    this._threejs.outputEncoding = THREE.sRGBEncoding;
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._threejs.domElement);

    //screen resize
    window.addEventListener('resize', () => {
      this.OnWindowResize();
    }, false);

    var renderer;
    var scene;
    var camera;
    var control;
    var stats;
    var cloudMesh;
    var skyMesh;
    var light1;
    var ls1;
    var mainLight;
    var sound;
    var treasurebox;


    //perspective camera

    const fov = 60;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 10000;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, 20, -25);
    this.camera.lookAt(0,10,0);


    //adding scene
    this.scene = new THREE.Scene();

    //seeting lighting

    mainLight=new THREE.AmbientLight(0xffffff,0.2);
    this.scene.add(mainLight);

    this.addStatsObject();
    var controls = new PointerLockControls( this.camera, document.body );
    var surfaceG=new THREE.PlaneGeometry(1000,1000);
    var surfaceM= new THREE.MeshPhongMaterial({ map: new THREE.TextureLoader().load('../assets/textures/surface.jpg'), side: THREE.DoubleSide });
    var surface= new THREE.Mesh(surfaceG,surfaceM);
    this.scene.add(surface);
    surface.rotation.x=Math.PI/2;
    surface.position.y=0;

    var cloudGeometry = new THREE.SphereGeometry(600,50,50);
    var cloudMaterial = this.createCloudMaterial();
    this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    this.cloudMesh.name = 'clouds';
    this.scene.add(this.cloudMesh);

    var skyGeometry = new THREE.SphereGeometry(620,50,50);
    var skyMaterial = new THREE.MeshBasicMaterial({color: 0x87CEEB , side:THREE.DoubleSide});
    this.skyMesh = new THREE.Mesh(skyGeometry,skyMaterial);
    this.scene.add(this.skyMesh);

    this.light1 = new THREE.DirectionalLight(0xFDFBD3 , 1.5);
    this.light1.position.y=580;
    this.scene.add(this.light1);
    var ls1Geometry = new THREE.SphereGeometry(15,50,50);
    var ls1Material = new THREE.MeshBasicMaterial( { color:0xFDFBD3 } );
    this.ls1 = new THREE.Mesh( ls1Geometry, ls1Material);
    this.ls1.position.set( this.light1.position.x, this.light1.position.y, this.light1.position.z);
    this.scene.add( this.ls1 );

    var controls = new PointerLockControls( this.camera, document.body );

    const blocker = document.getElementById( 'blocker' );
    const instructions = document.getElementById( 'instructions' );

    instructions.addEventListener( 'click', function () {

      controls.lock();

    }, false );

    controls.addEventListener( 'lock', function () {

      instructions.style.display = 'none';
      blocker.style.display = 'none';

    } );

    controls.addEventListener( 'unlock', function () {

      blocker.style.display = 'block';
      instructions.style.display = '';

    } );

   this.scene.add( controls.getObject() );

    // const controls = new OrbitControls(
    //   this.camera, this._threejs.domElement);
    // controls.target.set(0, 10, 0);
    // controls.update();

    const listener = new THREE.AudioListener();
    this.camera.add( listener );
    const listener2 = new THREE.AudioListener();
    this.camera.add( listener2 );
    const listener3 = new THREE.AudioListener();
    this.camera.add( listener3 );

    // create a global audio source
    var s = new THREE.Audio( listener );
    victorysound = new THREE.Audio( listener2 );
    dancesound = new THREE.Audio( listener3 );
    // load a sound and set it as the Audio object's buffer
    var audioLoader = new THREE.AudioLoader();
    audioLoader.load( '../assets/audio/wind.mp3', function( buffer) {
        s.setBuffer( buffer );
        s.setLoop( true );
        s.setVolume( 0.2 );
        s.play();
    });
    var audioLoader2 = new THREE.AudioLoader();
    audioLoader2.load( '../assets/audio/dance.mp3', function( buffer) {
        dancesound.setBuffer( buffer );
        dancesound.setVolume( 0.2 );
        //dancesound.play();
    });
    var audioLoader3 = new THREE.AudioLoader();
    audioLoader3.load( '../assets/audio/victory.mp3', function( buffer) {
        victorysound.setBuffer( buffer );
        victorysound.setVolume( 0.2 );
        //victorysound.play();
    });

    sound=s;
    // console.log(MAX_HEIGHT);
    this.create3DTerrain(50, 200, 2.5, 2.5, 25,370,0,0);
    this.create3DTerrain(50, 200, 2.5, 2.5, 25,370,0,-500);
    this.create3DTerrain(50, 200, 2.5, 2.5, 25,-500,0,0);
    this.create3DTerrain(50, 200, 2.5, 2.5, 25,-500,0,-500);
    this.create3DTerrain(200, 50, 2.5, 2.5, 25,-500,0,-500);
    this.create3DTerrain(200, 50, 2.5, 2.5, 25,0,0,-500);
    this.create3DTerrain(200, 50, 2.5, 2.5, 25,-500,0,380);
    this.create3DTerrain(200, 50, 2.5, 2.5, 25,0,0,380);


    var treeControl = new function() {
      this.seed = 2000;
      this.segments = 6;
      this.levels = 5;
      this.vMultiplier = 2.5;
      this.twigScale = 1.3;
      this.initalBranchLength = 10;
      this.lengthFalloffFactor = 0.85;
      this.lengthFalloffPower = 0.99;
      this.clumpMax = 0.454;
      this.clumpMin = 0.404;
      this.branchFactor = 2.45;
      this.dropAmount = -0.1;
      this.growAmount = 0.24;
      this.sweepAmount = 0.05;
      this.maxRadius = 2;
      this.climbRate = 0.371;
      this.trunkKink = 0.093;
      this.treeSteps = 40;
      this.taperRate = 0.947;
      this.radiusFalloffRate = 0.73;
      this.twistRate = 3.02;
      this.trunkLength = 25;
  };

    this.createTree(treeControl,1);

    treeControl.twigScale=2;
    treeControl.lengthFalloffFactor=1;
    treeControl.maxRadius=3;
    treeControl.treeSteps=60;
    treeControl.trunkLength=45;
    this.createTree(treeControl,2);

    treeControl.twigScale=2;
    treeControl.lengthFalloffFactor=0.8;
    treeControl.maxRadius=2.5;
    treeControl.treeSteps=50;
    treeControl.trunkLength=35;
    this.createTree(treeControl,3);

    var treasureboxG = new THREE.CubeGeometry(20,20,20);
    var cm=[
        new THREE.MeshPhongMaterial({ map: new THREE.TextureLoader().load('../assets/textures/bottom.jpg'), side: THREE.DoubleSide }),
        new THREE.MeshPhongMaterial({ map: new THREE.TextureLoader().load('../assets/textures/bottom.jpg'), side: THREE.DoubleSide }),
        new THREE.MeshPhongMaterial({ map: new THREE.TextureLoader().load('../assets/textures/top.jpg'), side: THREE.DoubleSide }),
        new THREE.MeshPhongMaterial({ map: new THREE.TextureLoader().load('../assets/textures/bottom.jpg'), side: THREE.DoubleSide }),
        new THREE.MeshPhongMaterial({ map: new THREE.TextureLoader().load('../assets/textures/front.jpg'), side: THREE.DoubleSide }),
        new THREE.MeshPhongMaterial({ map: new THREE.TextureLoader().load('../assets/textures/back.jpg'), side: THREE.DoubleSide }),

    ];
    var treasureboxM = new THREE.MeshFaceMaterial(cm);

    this.treasurebox = new THREE.Mesh(treasureboxG,treasureboxM);
//    this.scene.add(treasurebox);

    var x=Math.floor((Math.random() * (300 +300 + 1) ) -300);
    var z=Math.floor((Math.random() * (300 +300 + 1) ) -300);
    var y=10;
    this.treasurebox.position.set(x,y,z);
    //this.scene.add(this.treasurebox);
    console.log(this.treasurebox.position);
    document.onkeydown=function(e){
      if(e.key=='x'){
        is_cheat=true;
      }
    };
    //loading the texture into the skybox
    // const loader = new THREE.CubeTextureLoader();
    // const texture = loader.load([
    //     './models/posx.jpg',
    //     './models/negx.jpg',
    //     './models/posy.jpg',
    //     './models/negy.jpg',
    //     './models/posz.jpg',
    //     './models/negz.jpg',
    // ]);
    // texture.encoding = THREE.sRGBEncoding;
    // this.scene.background = texture;

    // const plane = new THREE.Mesh(
    //     new THREE.PlaneGeometry(100, 100, 10, 10),
    //     new THREE.MeshStandardMaterial({
    //         color: 0x808080,
    //       }));
    // plane.castShadow = false;
    // plane.receiveShadow = true;
    // plane.rotation.x = -Math.PI / 2;
    // this.scene.add(plane);

    this._mixers = [];
    this._previousRAF = null;

    // this.LoadCharacter();

    this._LoadAnimatedModel();
    this.OnRequestAnimationFram();

  }

  _LoadAnimatedModel() {
    const params = {
      camera: this.camera,
      scene: this.scene,
    }
    this._controls = new CharacterController(params);
    this._controls._position=new THREE.Vector3(0, 0, -450);
  }


  //_LoadAnimatedModelAndPlay=>loadCharacter


  LoadCharacter(path, modelFile, animFile, offset) {
    const loader = new FBXLoader();
    loader.setPath(path);

    //load the charater
    loader.load(modelFile, (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });
      fbx.position.copy(offset);

      const anim = new FBXLoader();
      anim.setPath(path); //setting path again

      //load animation to character
      anim.load(animFile, (anim) => {
        const m = new THREE.AnimationMixer(fbx); //adding animation mixture into the original character
        this._mixers.push(m);
        const idle = m.clipAction(anim.animations[0]);
        idle.play(); //to animate .play() method is used
      });
      this.scene.add(fbx);
    });
  }

  _LoadModel() {
    const loader = new GLTFLoader();
    loader.load('../assets/models/thing.glb', (gltf) => {
      gltf.scene.traverse(c => {
        c.castShadow = true;
      });
      this.scene.add(gltf.scene);
    });
  }

  OnWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  OnRequestAnimationFram() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }
      if(this._controls._rotation!=undefined){
        // this.camera.rotation.x=this._controls._rotation.x;
        // this.camera.rotation.y=this._controls._rotation.w;
        // this.camera.rotation.z=this._controls._rotation.z;
      }
      if(this._controls._position!=undefined)
      {
        this.camera.position.x=this._controls._position.x;
        this.camera.position.z=this._controls._position.z-25; 
        var xnear=this.treasurebox.position.x-10-20;
        var xfar=this.treasurebox.position.x+10+20;
        var znear=this.treasurebox.position.z-10-20;
        var zfar=this.treasurebox.position.z+10+20;
  
        if(is_win==false && this._controls._position.x>=xnear && this._controls._position.x<=xfar &&  this._controls._position.z>=znear && this._controls._position.z<=zfar){
          this.scene.add(this.treasurebox);
          // console.log("found.!");
          alert("Congratulations you have found the treasure.! You can reload to restart the game or you can roam around.");
          is_win=true;
          victorysound.play();
        }
        
      }
      if(is_cheat==true){
        this._controls._position.x=xnear;
        this._controls._position.z=znear;
        is_cheat=false;

      }
      this.cloudMesh.rotation.y+=0.0001;
      this.light1.position.x=this.light1.position.x*Math.cos(Math.PI*0.1/180) + this.light1.position.y*Math.sin(Math.PI*0.1/180);
      this.light1.position.y= -this.light1.position.x*Math.sin(Math.PI*0.1/180) +this.light1.position.y*Math.cos(Math.PI*0.1/180);
      this.ls1.position.set( this.light1.position.x, this.light1.position.y, this.light1.position.z);

      this.OnRequestAnimationFram();
      this._threejs.render(this.scene, this.camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map(m => m.update(timeElapsedS));
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }
  }
  createTree(config,type) {

    var twig = this.scene.getObjectByName('twig');
    var trunk = this.scene.getObjectByName('trunk');

    if (twig) this.scene.remove(twig);
    if (trunk) this.scene.remove(trunk);


    var myTree = new Tree({
        "seed": config.seed,
        "segments": config.segments,
        "levels": config.levels,
        "vMultiplier": config.vMultiplier,
        "twigScale": config.twigScale,
        "initalBranchLength": config.initalBranchLength,
        "lengthFalloffFactor": config.lengthFalloffFactor,
        "lengthFalloffPower": config.lengthFalloffPower,
        "clumpMax": config.clumpMax,
        "clumpMin": config.clumpMin,
        "branchFactor": config.branchFactor,
        "dropAmount": config.dropAmount,
        "growAmount": config.growAmount,
        "sweepAmount": config.sweepAmount,
        "maxRadius": config.maxRadius,
        "climbRate": config.climbRate,
        "trunkKink": config.trunkKink,
        "treeSteps": config.treeSteps,
        "taperRate": config.taperRate,
        "radiusFalloffRate": config.radiusFalloffRate,
        "twistRate": config.twistRate,
        "trunkLength": config.trunkLength
    });

    // console.log(myTree);

    var trunkGeom = new THREE.Geometry();
    var leaveGeom = new THREE.Geometry();


    // convert the faces
    myTree.faces.forEach(function(f) {
        trunkGeom.faces.push(new THREE.Face3(f[0],f[1],f[2]));
    });


    myTree.facesTwig.forEach(function(f) {
        leaveGeom.faces.push(new THREE.Face3(f[0],f[1],f[2]));
    });

//    // setup uvsTwig
    myTree.facesTwig.forEach(function(f) {
        var uva = myTree.uvsTwig[f[0]];
        var uvb = myTree.uvsTwig[f[1]];
        var uvc = myTree.uvsTwig[f[2]];

        var vuva = new THREE.Vector2(uva[0],uva[1]);
        var vuvb = new THREE.Vector2(uvb[0],uvb[1]);
        var vuvc = new THREE.Vector2(uvc[0],uvc[1]);

        leaveGeom.faceVertexUvs[0].push([vuva, vuvb, vuvc]);
    });


    // setup uvsTwig
    myTree.faces.forEach(function(f) {
        var uva = myTree.UV[f[0]];
        var uvb = myTree.UV[f[1]];
        var uvc = myTree.UV[f[2]];

        var vuva = new THREE.Vector2(uva[0],uva[1]);
        var vuvb = new THREE.Vector2(uvb[0],uvb[1]);
        var vuvc = new THREE.Vector2(uvc[0],uvc[1]);

        trunkGeom.faceVertexUvs[0].push([vuva, vuvb, vuvc]);
    });

    // convert the vertices
    myTree.verts.forEach(function(v) {
      trunkGeom.vertices.push(new THREE.Vector3(v[0],v[1],v[2]));
    });

    myTree.vertsTwig.forEach(function(v) {
      leaveGeom.vertices.push(new THREE.Vector3(v[0],v[1],v[2]));
     });
  

    var leaveMat = new THREE.MeshLambertMaterial();
    if(type==1)
    leaveMat.map = THREE.ImageUtils.loadTexture("../assets/textures/leaf.png");
    if(type==2)
    leaveMat.map = THREE.ImageUtils.loadTexture("../assets/textures/leaf2.png");
    if(type==3)
    leaveMat.map = THREE.ImageUtils.loadTexture("../assets/textures/leaf3.png");

    leaveMat.doubleSided = true;
    leaveMat.transparent = true;


    var trunkMat = new THREE.MeshLambertMaterial();
    if(type==1 || type==3)
    trunkMat.map = THREE.ImageUtils.loadTexture("../assets/textures/birch.jpg");
    else
    trunkMat.map = THREE.ImageUtils.loadTexture("../assets/textures/birch2.jfif");

    trunkMat.doubleSided = true;
    trunkMat.transparent = true;

    trunkGeom.computeFaceNormals();
    leaveGeom.computeFaceNormals();
    trunkGeom.computeVertexNormals(true);
    leaveGeom.computeVertexNormals(true);

    var trunkMesh = new THREE.Mesh(trunkGeom, trunkMat);
    trunkMesh.name = 'trunk';
    // console.log(trunkMesh);

    var twigMesh = new THREE.Mesh(leaveGeom, leaveMat);
    twigMesh.name = 'twig';

    this.scene.add(trunkMesh);
    this.scene.add(twigMesh);

     var t2=[];
     var tw2=[];
     var cnt=Math.floor(Math.random() * (60 - 50 + 1) ) + 50;

     for(var i=0;i<cnt;i++){
       t2[i]=trunkMesh.clone();
       tw2[i]=twigMesh.clone();

       var x=Math.floor((Math.random() * (400 +400 + 1) ) -400);
       var z=Math.floor((Math.random() * (400 +400 + 1) ) -400);

       t2[i].position.x+=x;
       tw2[i].position.x+=x;
       t2[i].position.z+=z;
       tw2[i].position.z+=z;

       this.scene.add(t2[i]);
       this.scene.add(tw2[i]);
   
     }

    // var t2=trunkMesh.clone();
    // var tw2=twigMesh.clone();

    // // console.log(t2.position);
    // t2.position.x+=200;
    // tw2.position.x+=200;

    // this.scene.add(t2);
    // this.scene.add(tw2);


}

  createCloudMaterial() {
    var cloudTexture = THREE.ImageUtils.loadTexture("../assets/textures/planets/fair_clouds_4k.png");
   //var cloudTexture = THREE.ImageUtils.loadTexture("../assets/textures/planets/earthcloudmap.jpg");
   
   var cloudMaterial = new THREE.MeshBasicMaterial();
       cloudMaterial.map = cloudTexture;
       cloudMaterial.side = THREE.DoubleSide;
       cloudMaterial.transparent = true;
   
       return cloudMaterial;
   }
   
   create3DTerrain(width, depth, spacingX, spacingZ, height,px,py,pz) {
   
       var date = new Date();
       noise.seed(date.getMilliseconds());
   
   
       // first create all the individual vertices
       var geometry = new THREE.Geometry();
       for (var z = 0 ; z < depth ; z++) {
           for (var x = 0 ; x < width ; x++) {
               var yValue = Math.abs(noise.perlin2(x/7, z/7) * height*2);
               var vertex = new THREE.Vector3(x*spacingX, yValue,z*spacingZ);
               geometry.vertices.push(vertex);
           }
       }
   
       // next we need to define the faces. Which are triangles
       // we create a rectangle between four vertices, and we do
       // that as two triangles.
       for (var z = 0 ; z < depth-1 ; z++) {
           for (var x = 0 ; x < width-1 ; x++) {
               // we need to point to the position in the array
               // a - - b
               // |  x  |
               // c - - d
               var a = x + z*width;
               var b = (x+1) + (z * width);
               var c = x + ((z+1) * width);
               var d = (x+1) + ((z+1) * width);
   
               // define the uvs for the vertices we just created.
               var uva = new THREE.Vector2( x / (width-1) ,1 - z / (depth - 1) );
               var uvb = new THREE.Vector2( (x + 1) / (width-1) ,1 - z / (depth - 1) );
               var uvc = new THREE.Vector2( x / (width-1) ,1 - (z + 1) / (depth - 1) );
               var uvd = new THREE.Vector2( (x + 1) / (width-1) ,1 - (z + 1) / (depth - 1) );
   
               var face1 = new THREE.Face3(b, a, c );
               var face2 = new THREE.Face3(c ,d, b );
   
               face1.color = new THREE.Color(scale(this.getHighPoint(geometry,face1)));
               face2.color = new THREE.Color(scale(this.getHighPoint(geometry, face2)));
   
               geometry.faces.push(face1);
               geometry.faces.push(face2);
   
               geometry.faceVertexUvs[ 0 ].push( [ uvb, uva, uvc ] );
               geometry.faceVertexUvs[ 0 ].push( [ uvc, uvd, uvb ] );
           }
       }
   
   
   
       // compute the normals
       geometry.computeVertexNormals(true);
       geometry.computeFaceNormals();
   
       // setup the material
       var mat = new THREE.MeshPhongMaterial();
       mat.map = THREE.ImageUtils.loadTexture("../assets/textures/wood_1-1024x1024.png");
   //    mat.map = THREE.ImageUtils.loadTexture("../assets/textures/debug.jpg");
   
       // create the mesh
       var groundMesh = new THREE.Mesh(geometry,mat);
       groundMesh.translateX(px);
       groundMesh.translateZ(pz);
       groundMesh.translateY(-3);
       groundMesh.name = 'terrain';
       this.scene.add(groundMesh);
   }
   
   getHighPoint(geometry, face) {
   
       var v1 = geometry.vertices[face.a].y;
       var v2 = geometry.vertices[face.b].y;
       var v3 = geometry.vertices[face.c].y;
   
       return Math.max(v1, v2, v3);
   }
   
   //------------------------------------------------------
   // Main render loop
   //------------------------------------------------------
   
   
   /**
    * Called when the scene needs to be rendered. Delegates to requestAnimationFrame
    * for future renders
    */
   
   
   //------------------------------------------------------
   // Some generic helper 
   //------------------------------------------------------
   
   /**
    * Create the control object, based on the supplied configuration
    *
    * @param controlObject the configuration for this control
    */
   addControlGui(controlObject) {
       var gui = new dat.GUI();
       gui.add(controlObject,'toFaceMaterial');
       gui.add(controlObject,'toNormalMaterial');
       gui.add(controlObject,'smoothShading').onChange(controlObject.onSmoothShadingChange);
   }
   
   /**
    * Add the stats object to the top left border
    */
   addStatsObject() {
       this.stats = new Stats();
       this.stats.setMode(0);
   
       this.stats.domElement.style.position = 'absolute';
       this.stats.domElement.style.left = '0px';
       this.stats.domElement.style.top = '0px';
   
       document.body.appendChild( this.stats.domElement );
   }

}

// console.log(MAX_HEIGHT);
let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new SetCharacterSetup();
});