console.log(require('./template.html'));

module.exports = {
	className : 'products',
	template : require('./template.html'),
	

    computed : {
        total : function(){
            return this.qty * this.price;
        }
    }
};