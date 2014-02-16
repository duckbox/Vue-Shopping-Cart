
var Vue = require('vue');

    var canvas = document.querySelector('canvas'),
        context = canvas.getContext('2d'),
        imgContext,
        $wrapper = document.getElementById('can-wrapper');

        $wrapper.style.height = window.innerHeight + 100 + 'px';
        $wrapper.style.width = window.innerWidth + 100 + 'px';

function blurBookBackground() {
    
    var image = new Image();

    canvas.width = window.innerWidth * 1.6;
    canvas.height = window.innerHeight * 1.6;

    image.addEventListener('load',function cb(){

        context.drawImage(this,100,180,600,600,0,0,window.innerWidth*1.6,window.innerWidth*1.6);
        this.removeEventListener('load',cb);
        imageContext = this;

    },false);

    image.src = 'images/gotye.jpg';

}

window.addEventListener('resize', function(){

    context.drawImage(imageContext,100,180,600,600,0,0,window.innerWidth*1.6,window.innerWidth*1.6);
    
}, false);

blurBookBackground();

var container = new Vue({

    el: '#shopping-cart',

    components: {
        products: require('./components/products')
    },

    data: {
        products : [{
            name : 'Foo',
            qty : 4,
            price : 2.99
        },{
            name : 'Foo2',
            qty : 3,
            price : 1.99
        }]
    }
});
