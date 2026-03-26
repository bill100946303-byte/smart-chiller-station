class Storage{

    set(name,info){
        localStorage.setItem(name,info)
    }
    get(name){
        return localStorage.getItem(name)
    }
    remove(name){
        localStorage.removeItem(name);
    }
    clear(){
        localStorage.clear();
    }
}
export default new Storage()