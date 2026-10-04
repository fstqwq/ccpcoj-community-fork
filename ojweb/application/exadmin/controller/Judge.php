<?php
namespace app\exadmin\controller;
use app\admin\controller\Judge as AdminJudge;

/**
 * exadmin Judge 控制器
 * 完全继承 admin/Judge，复用评测数据管理逻辑
 * 不涉及 course_key 逻辑，只需重写模板路径
 */
class Judge extends AdminJudge
{
    /**
     * 重写：使用 admin 模块的模板
     * 因为 exadmin 模块没有 judge 视图目录
     */
    public function judgedata_manager()
    {
        $module = $this->request->module();
        $this->assign([
            'pagetitle'         => 'Judge Data ' . $this->inputInfo['id'],
            'inputinfo'         => $this->inputInfo,
            'iteminfo'          => $this->itemInfo,
            'file_url'          => '/' . $module . '/judge/judgedata_manager_ajax?item=' . $this->inputInfo['item'] . '&id=' . $this->inputInfo['id'],
            'delete_url'        => '/' . $module . '/judge/file_delete_ajax?item=' . $this->inputInfo['item'] . '&id=' . $this->inputInfo['id'],
            'rename_url'        => '/' . $module . '/judge/file_rename_ajax?item=' . $this->inputInfo['item'] . '&id=' . $this->inputInfo['id'],
            'upload_url'        => '/' . $module . '/judge/upload_ajax',
            'method_button'     => 'File Type',
            "attach_notify"     => '<strong class="text-danger">.in、.out 以及只支持基于 testlib 的 <code>tpj.cc</code></strong><span class="en-text"><code>.in</code>, <code>.out</code> and only "tpj.cc" files based on testlib are supported.</span>
            上传zip将自动解压，不合法文件会自动删除。<span class="en-text">Uploaded zip file will be automatically decompressed. If invalid files exists in the zip, they"ll be automatically deleted without notification.</span>
            系统只递归搜索与zip文件同名的文件夹，例如 "test" 文件夹在 "test.zip" 文件中。<span class="en-text">System will only recursively search folder with the same name of the zip file, e.g. a "test" folder in a "test.zip" file.</span>'
        ]);
        // 使用 admin 模块的模板
        return $this->fetch('admin@judge/judgedata_manager');
    }
}

