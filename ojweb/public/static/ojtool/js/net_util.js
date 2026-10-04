// ojtool 模块的网络工具，使用全局的 csg 对象（util.js）
// 为了保持向后兼容，保留 csgn 别名
var csgn = {
    ajax: async function(method, url, data={}, dtype='json') {
        return csg.ajax(method, url, data, {}, dtype, 'json');
    },
    get: function(url, data={}, dtype='json') {
        return csg.get(url, data, {}, dtype);
    },
    post: function(url, data={}, dtype='json') {
        return csg.post(url, data, {}, dtype);
    },
    Json2Url(data) {
        return csg.Json2Url(data);
    },
    Url2Json() {
        return csg.Url2Json();
    },
    async_ajax: async function(method, url, data={}, dtype='json') {
        return csg.ajax(method, url, data, {}, dtype, 'json');
    },
    async_get: async function(url, data={}, dtype='json') {
        return csg.get(url, data, {}, dtype);
    },
    async_post: async function(url, data={}, dtype='json') {
        return csg.post(url, data, {}, dtype);
    },
}