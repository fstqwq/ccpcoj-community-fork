/**
 * CSG Zip.js bootstrap/config
 *
 * 统一 zip.js 配置：默认关闭 WebWorker，防止 data/blob worker 在部分代理环境下报错。
 * 提供通用的资源加载和打包工具函数。
 */
(function () {
  'use strict';

  function safeConfigureZip() {
    if (typeof window === 'undefined') return;
    if (!window.zip || typeof window.zip.configure !== 'function') return;

    // 由后端模板注入：window.CSG_ZIPJS_CFG（可选）
    var cfg = window.CSG_ZIPJS_CFG || {};
    if (cfg && cfg.auto === false) return;

    // 默认关闭 WebWorker，防止 data/blob worker 在部分代理环境下报错
    var useWorkers = false;

    try {
      window.zip.configure({
        useCompressionStream: false,
        useWebWorkers: useWorkers
      });
    } catch (e) {
      try { console.warn('[csg_zipjs] zip.configure failed', e); } catch (e2) {}
    }
  }

  // 立即执行一次
  safeConfigureZip();

  // 若 zip.js 可能被延后加载，提供一个手动触发口子
  window.CsgZipEnsureConfigured = safeConfigureZip;

  /**
   * CSG Zip 工具对象
   * 提供通用的资源加载和打包方法
   */
  window.CsgZip = {
    /**
     * 从 URL 获取资源并添加到 zip，失败时可通过回调处理但继续执行
     * 
     * @param {zip.ZipWriter} zipWriter - zip 写入器实例
     * @param {string} url - 资源 URL
     * @param {string} zipPath - zip 中的文件路径
     * @param {Object} options - 配置选项
     * @param {Function} options.onError - 错误回调函数，参数为 (error, url, zipPath, context)
     * @param {string} options.context - 上下文信息（如题目名称），用于错误提示
     * @param {boolean} options.continueOnError - 错误时是否继续（返回 resolved Promise），默认 true
     * @returns {Promise} 始终 resolve，失败时调用 onError 回调
     * 
     * @example
     * // 基本用法
     * await CsgZip.addUrlResource(zipWriter, '/static/css/style.css', 'resource/style.css');
     * 
     * @example
     * // 带错误处理
     * await CsgZip.addUrlResource(zipWriter, url, path, {
     *   context: '题目A',
     *   onError: (error, url, path, context) => {
     *     alerty.alert(`${context}：资源不存在 ${url}`);
     *   }
     * });
     */
    addUrlResource: async function(zipWriter, url, zipPath, options) {
      options = options || {};
      var onError = options.onError;
      var context = options.context;
      var continueOnError = options.continueOnError !== false; // 默认 true

      try {
        var response = await fetch(url);
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        var blob = await response.blob();
        
        // 确保 zipWriter.add 的 Promise 也不会导致整个导出失败
        try {
          return await zipWriter.add(zipPath, new zip.BlobReader(blob));
        } catch (addError) {
          throw new Error('添加到zip失败: ' + addError.message);
        }
      } catch (error) {
        // 调用错误回调
        if (typeof onError === 'function') {
          try {
            onError(error, url, zipPath, context);
          } catch (e) {
            try { console.warn('[csg_zipjs] onError callback failed', e); } catch (e2) {}
          }
        }
        
        // 根据配置决定是否继续
        if (continueOnError) {
          return Promise.resolve();
        } else {
          return Promise.reject(error);
        }
      }
    },

    /**
     * 批量添加 URL 资源到 zip
     * 
     * @param {zip.ZipWriter} zipWriter - zip 写入器实例
     * @param {Array} resources - 资源数组，每个元素为 {url, zipPath, context?}
     * @param {Object} options - 配置选项（同 addUrlResource）
     * @returns {Array<Promise>} Promise 数组，可用于 Promise.all
     * 
     * @example
     * const tasks = CsgZip.addUrlResources(zipWriter, [
     *   {url: '/static/css/a.css', zipPath: 'resource/a.css'},
     *   {url: '/static/js/b.js', zipPath: 'resource/b.js', context: '题目B'}
     * ], {
     *   onError: (error, url, path, context) => {
     *     console.warn('Failed:', url);
     *   }
     * });
     * await Promise.all(tasks);
     */
    addUrlResources: function(zipWriter, resources, options) {
      return resources.map(function(resource) {
        var resourceOptions = Object.assign({}, options, {
          context: resource.context || options.context
        });
        return this.addUrlResource(zipWriter, resource.url, resource.zipPath, resourceOptions);
      }.bind(this));
    }
  };
})();


