<hr id="hidden_user_panel">
<div id="menu_container"></div>

<script type="text/javascript">
// 传递菜单配置给 JavaScript
window.menuConfig = {
    OJ_MODE: "<?php echo $OJ_MODE; ?>",
    OJ_STATUS: "<?php echo $OJ_STATUS; ?>",
    OJ_OPEN_ARCHIVE: <?php echo $OJ_OPEN_ARCHIVE ? 'true' : 'false'; ?>,
    module: "<?php echo $module; ?>",
    controller: "<?php echo $controller; ?>",
    action: "<?php echo $action; ?>",
    isAdmin: <?php echo $isAdmin ? 'true' : 'false'; ?>,
    hasAnyAdminPrivilege: <?php 
        $showadmin = false;
        foreach($ojAdminList as $adminStr => $adminName) {
            if (IsAdmin($adminStr)) {
                $showadmin = true;
                break;
            }
        }
        echo $showadmin ? 'true' : 'false'; 
    ?>,
    isCourseTeacher: <?php 
        if(function_exists('PrivCourse') && isset($NOW_COURSE_KEY)) {
            echo PrivCourse('teacher', $NOW_COURSE_KEY) ? 'true' : 'false';
        } else {
            echo 'false';
        }
    ?>,
    isLoggedIn: <?php echo session('?user_id') ? 'true' : 'false'; ?>,
    OJ_FLG_LOGIN_DISABLED: <?php echo (isset($OJ_FLG_LOGIN_DISABLED) && $OJ_FLG_LOGIN_DISABLED) ? 'true' : 'false'; ?>,
    userType: "<?php echo isset($userType) ? $userType : 'guest'; ?>",
    OJ_ADDITION_LINK: <?php echo json_encode($OJ_ADDITION_LINK ?? ''); ?>,
    // 调试信息
    debugInfo: {
        userType: "<?php echo isset($userType) ? $userType : 'guest'; ?>",
        isCourseTeacher: <?php 
            if(function_exists('PrivCourse') && isset($NOW_COURSE_KEY)) {
                echo PrivCourse('teacher', $NOW_COURSE_KEY) ? 'true' : 'false';
            } else {
                echo 'false';
            }
        ?>,
        NOW_COURSE_KEY: "<?php echo isset($NOW_COURSE_KEY) ? $NOW_COURSE_KEY : ''; ?>"
    }
};
</script>
{css href="__STATIC__/csgoj/public/menu.css" /}
{js href="__STATIC__/csgoj/public/menu.js" /}