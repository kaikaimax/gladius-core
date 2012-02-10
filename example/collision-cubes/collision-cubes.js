/*global gladius, console */

document.addEventListener( "DOMContentLoaded", function( e ){

    var printd = function( div, str ) {
        document.getElementById( div ).innerHTML = str + '<p>';
    };
    var cleard = function( div ) {
        document.getElementById( div ).innerHTML = '';
    };

    var canvas = document.getElementById( "test-canvas" );    
    var resources = {};

    var game = function( engine ) {
        var math = engine.math;

        var CubicVR = engine.graphics.target.context;

        var Collision2Service = engine.base.Service({
            type: 'Physics',
            schedule: {
                update: {
                    phase: engine.scheduler.phases.UPDATE
                }
            },
            time: engine.scheduler.simulationTime
        },
        function( options ) {

            var that = this;
            var service = this;

            var BoundingBox = engine.base.Component({
                type: 'Collision',
                depends: ['Transform']
            },
            function( options ) {
                this.lowerLeft = options.lowerLeft;
                this.upperRight = options.upperRight;               

                // Boilerplate component registration; Lets our service know that we exist and want to do things
                this.onComponentOwnerChanged = function( e ){
                    if( e.data.previous === null && this.owner !== null ) {
                        service.registerComponent( this.owner.id, this );
                    }

                    if( this.owner === null && e.data.previous !== null ) {
                        service.unregisterComponent( e.data.previous.id, this );
                    }
                };

                this.onEntityManagerChanged = function( e ) {
                    if( e.data.previous === null && e.data.current !== null && this.owner !== null ) {
                        service.registerComponent( this.owner.id, this );
                    }

                    if( e.data.previous !== null && e.data.current === null && this.owner !== null ) {
                        service.unregisterComponent( this.owner.id, this );
                    }
                };
            });

            this.update = function() {

                for( var componentType in that.components ) {
                    for( var entityId in that.components[componentType] ) {
                        while( that.components[componentType][entityId].handleQueuedEvent() ) {}
                    }
                }

                function checkCollision( box1, box2 ) {
                    var top1, top2,
                        bottom1, bottom2,
                        left1, left2,
                        right1, right2;
                    
                    top1 = box1.upperRight[1];
                    top2 = box2.upperRight[1];
                    bottom1 = box1.lowerLeft[1];
                    bottom2 = box2.lowerLeft[1];
                    left1 = box1.lowerLeft[0];
                    left2 = box2.lowerLeft[0];
                    right1 = box1.upperRight[0];
                    right2 = box2.upperRight[0];
                    
                    var outsideBottom = bottom1 > top2,
                        outsideTop = top1 < bottom2,
                        outsideLeft = left1 > right2,
                        outsideRight = right1 < left2;
                        
                    return !( outsideBottom || outsideTop || outsideLeft || outsideRight );
                }

                for( var collisionEntity1 in that.components.Collision ) {
                    var component1 = that.components.Collision[collisionEntity1];
                    var box1 = null;
                    var box2 = null;

                    for( var collisionEntity2 in that.components.Collision ) {
                        if( collisionEntity1 !== collisionEntity2 ) {
                            var component2 = that.components.Collision[collisionEntity2];
                            
                            if( !box1 ) {
                                var transform1 = component1.owner.find( 'Transform' );
                                box1 = {
                                        lowerLeft: math.vector2.add(
                                                    transform1.position,
                                                    component1.lowerLeft
                                                ),
                                        upperRight: math.vector2.add(
                                                    transform1.position,
                                                    component1.upperRight
                                                )
                                };
                            }
                            
                            var transform2 = component2.owner.find( 'Transform' );
                            box2 = {
                                    lowerLeft: math.vector2.add(
                                                transform2.position,
                                                component2.lowerLeft
                                            ),
                                    upperRight: math.vector2.add(
                                                transform2.position,
                                                component2.upperRight
                                            )
                            };

                            if ( checkCollision( box1, box2 ) ) {
                                new engine.core.Event({
                                    type: 'Collision',
                                    data: {
                                        entity: component2.owner
                                    }
                                }).dispatch( [component1.owner] );
                            }

                        }
                    }
                }
            };

            var _components = {

                    BoundingBox: BoundingBox

            };

            Object.defineProperty( this, 'component', {
                get: function() {
                    return _components;
                }
            });
        });

        var collision2Service = new Collision2Service();

        var PlayerComponent = engine.base.Component({
            type: 'Player',
            depends: ['Transform']    // We're going to be moving stuff
        },
        function( options ) {

            options = options || {};
            var that = this;

            // This is a hack so that this component will have its message
            // queue processed
            var service = engine.logic; 

            var moveStates = {
                    LEFT: -1,
                    IDLE: 0,
                    RIGHT: 1
            };
            var moveState = moveStates.IDLE;
            var speed = options.speed || 10;

            this.onStartMove = function( event ) {
                moveState = moveStates[event.data.direction];                             
            };

            this.onStopMove = function( event ) {
                moveState = moveStates.IDLE;
            };
            
            this.onCollision = function( event ) {
                console.log( that.owner.id, '->', event.data.entity.id );
            };

            this.onUpdate = function( event ) {
                var transform = this.owner.find( 'Transform' );
                var delta = service.time.delta;

                transform.position = math.vector3.add(
                        transform.position,
                        [moveState * delta/1000 * speed, 0, 0]
                );
            };

            // Boilerplate component registration; Lets our service know that we exist and want to do things
            this.onComponentOwnerChanged = function( e ){
                if( e.data.previous === null && this.owner !== null ) {
                    service.registerComponent( this.owner.id, this );
                }

                if( this.owner === null && e.data.previous !== null ) {
                    service.unregisterComponent( e.data.previous.id, this );
                }
            };

            this.onEntityManagerChanged = function( e ) {
                if( e.data.previous === null && e.data.current !== null && this.owner !== null ) {
                    service.registerComponent( this.owner.id, this );
                }

                if( e.data.previous !== null && e.data.current === null && this.owner !== null ) {
                    service.unregisterComponent( this.owner.id, this );
                }
            };

        });

        var run = function() {

            // Make a new space for our entities
            var space = new engine.core.Space();

            canvas = engine.graphics.target.element;

            var cube0 = new space.Entity({
                name: 'cube0',
                components: [
                             new engine.core.component.Transform({
                                 position: math.Vector3( -2, 0, 0 ),
                                 rotation: math.Vector3( 0, 0, 0 )
                             }),
                             new engine.graphics.component.Model({
                                 mesh: resources.mesh,
                                 material: resources.material
                             }),
                             new engine.input.component.Controller({
                                 onKey: function(e) {
                                     if( this.owner ) {
                                         // If we have an owner, dispatch a game event for it to enjoy
                                         var rotate;
                                         switch( e.data.code ) {
                                         case 'A':
                                             new engine.core.Event({
                                                 type: e.data.state === 'down' ? 'StartMove' : 'StopMove',
                                                         data: {
                                                             direction: 'LEFT'
                                                         }
                                             }).dispatch( [this.owner] );
                                             break;
                                         case 'D': 
                                             new engine.core.Event({
                                                 type: e.data.state === 'down' ? 'StartMove' : 'StopMove',
                                                         data: {
                                                             direction: 'RIGHT'
                                                         }
                                             }).dispatch( [this.owner] );
                                             break;
                                         }
                                     }
                                 }
                             }),
                             new PlayerComponent(),
                             new collision2Service.component.BoundingBox({
                                 lowerLeft: math.Vector2( -0.5, -0.5 ),
                                 upperRight: math.Vector2( 0.5, 0.5 )
                             }) 
                             ]
            });

            var cube1 = new space.Entity({
                name: 'cube1',
                components: [
                             new engine.core.component.Transform({
                                 position: math.Vector3( 2, 0, 0 ),
                                 rotation: math.Vector3( 0, 0, 0 )
                             }),
                             new engine.graphics.component.Model({
                                 mesh: resources.mesh,
                                 material: resources.material
                             }),
                             new engine.input.component.Controller({
                                 onKey: function(e) {
                                     if( this.owner ) {
                                         // If we have an owner, dispatch a game event for it to enjoy
                                         var rotate;
                                         switch( e.data.code ) {
                                         case 'J':
                                             new engine.core.Event({
                                                 type: e.data.state === 'down' ? 'StartMove' : 'StopMove',
                                                         data: {
                                                             direction: 'LEFT'
                                                         }
                                             }).dispatch( [this.owner] );
                                             break;
                                         case 'L': 
                                             new engine.core.Event({
                                                 type: e.data.state === 'down' ? 'StartMove' : 'StopMove',
                                                         data: {
                                                             direction: 'RIGHT'                                                             
                                                         }
                                             }).dispatch( [this.owner] );
                                             break;
                                         }
                                     }
                                 }
                             }),
                             new PlayerComponent(),
                             new collision2Service.component.BoundingBox({
                                 lowerLeft: math.Vector2( -0.5, -0.5 ),
                                 upperRight: math.Vector2( 0.5, 0.5 )
                             })
                             ]
            });


            var camera = new space.Entity({
                name: 'camera',
                components: [
                             new engine.core.component.Transform({
                                 position: math.Vector3( 0, 0, 10 )
                             }),
                             new engine.graphics.component.Camera({
                                 active: true,
                                 width: canvas.width,
                                 height: canvas.height,
                                 fov: 60
                             }),
                             new engine.graphics.component.Light({ intensity: 50 })
                             ]
            });
            camera.find( 'Camera' ).target = math.Vector3( 0, 0, 0 );

            var task = new engine.scheduler.Task({
                schedule: {
                    phase: engine.scheduler.phases.UPDATE
                },
                callback: function() {
                    var delta = engine.scheduler.simulationTime.delta/1000;

                }
            });

            // Start the engine!
            engine.run();

        };

        engine.core.resource.get(
                [
                 {
                     type: engine.graphics.resource.Mesh,
                     url: 'procedural-mesh.js',                          
                     load: engine.core.resource.proceduralLoad,
                     onsuccess: function( mesh ) {
                         resources.mesh = mesh;
                     },
                     onfailure: function( error ) {
                     }
                 },
                 {
                     type: engine.graphics.resource.Material,
                     url: 'procedural-material.js',
                     load: engine.core.resource.proceduralLoad,
                     onsuccess: function( material ) {
                         resources.material = material;
                     },
                     onfailure: function( error ) {
                     }
                 }],
                 {
                    oncomplete: run
                 }
        );

    };


    gladius.create(
            {
                debug: true,
                services: {
                    graphics: {
                        src: 'graphics/service',
                        options: {
                            canvas: canvas
                        }
                    },
                    input: {
                        src: 'input/service',
                        options: {

                        }
                    },
                    logic: 'logic/game/service'
                }
            },
            game
    );

});
