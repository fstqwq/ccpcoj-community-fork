{/*
  统一的 比赛/考试 登录框（label 左侧布局，Bootstrap5 风格）
  - 通过 $csg_login_variant 区分不同业务：
    - 'exam'    : examsys 考试账号登录（带密码模式检测提示）
    - 'contest' : cpcsys 比赛账号登录（team_id + password，可选免密按钮）
  - 依赖：__STATIC__/csgoj/contest/contest_auth_index.css 中的 .exam-auth-table 样式
*/}

{if isset($needAuth) && $needAuth /}
    {if $csg_login_variant == 'exam' /}
        <div class="alert alert-warning exam-auth-container">
            <div class="d-flex flex-nowrap align-items-flex-start gap-3 mb-2 exam-auth-header-row">
                <div class="d-flex align-items-center exam-auth-title-stack flex-shrink-0">
                    <i class="bi bi-shield-lock me-2 flex-shrink-0"></i>
                    <span class="bilingual-stack">需要使用考试账号登录<span class="en-text">You need to log in with the exam account.</span></span>
                </div>
                <div id="exam_auth_error_alert" class="exam-auth-hint-box flex-grow-1 min-w-0" style="display: none;"></div>
            </div>

            <form id="contest_auth_form" method='post' action="/{$module}/contest/contest_auth_ajax" class="exam-auth-form" autocomplete="off">
                <input type="hidden" id="cid_input" name="cid" value="{$contest['contest_id']}">

                <div class="d-flex align-items-stretch gap-3 exam-auth-form-row">
                    <table class="exam-auth-table">
                        <tr>
                            <td class="label-cell">
                                <label for="cpc_team_id" class="form-label">用户名<span class="en-text">Username</span></label>
                            </td>
                            <td class="input-cell">
                                <!-- 隐藏的假输入框，防止浏览器自动填充系统登录框的账号密码 -->
                                <input type="text" name="contest_username_fake" autocomplete="off" tabindex="-1" aria-hidden="true" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
                                <input type="password" name="contest_password_fake" autocomplete="new-password" tabindex="-1" aria-hidden="true" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">

                                <input type="text" id="cpc_team_id" name="team_id" class="form-control" placeholder="用户名 / User Name" required autofocus autocomplete="off" data-bs-toggle="tooltip" data-bs-placement="top" title="" />
                            </td>
                        </tr>
                        <tr id="cpc_password_row">
                            <td class="label-cell">
                                <label for="cpc_password" class="form-label">
                                    密码<span class="en-text">Password</span>
                                </label>
                            </td>
                            <td class="input-cell">
                                <div class="password-input-wrapper">
                                    <input type="password" id="cpc_password" name="password" class="form-control password-waiting" placeholder="密码 / Password" required autocomplete="new-password" data-bs-toggle="tooltip" data-bs-placement="top" title="" />
                                    <small class="password-hint" id="password_hint">
                                        <i class="bi bi-info-circle"></i>
                                        <span>先输入用户名，系统将自动检测登录模式<span class="en-text">Enter username first, system will auto-detect login mode</span></span>
                                    </small>
                                </div>
                            </td>
                        </tr>
                    </table>
                    <div class="exam-auth-btn-cell">
                        <button type="submit" id="submit_button_clogin" class="btn btn-primary">登录考试<span class="en-text">Login Exam</span></button>
                    </div>
                </div>
            </form>
        </div>
    {elseif $csg_login_variant == 'contest' /}
        <div class="alert alert-warning exam-auth-container">
            <div class="d-flex align-items-center mb-2">
                <i class="bi bi-people me-2"></i>
                <span class="bilingual-inline">请登录比赛账号<span class="en-text">You need to log in with the contest account.</span></span>
            </div>

            <form id="contest_auth_form" method='post' action="/{$module}/contest/contest_auth_ajax" class="exam-auth-form" autocomplete="off">
                <input type="hidden" class="form-control" name="cid" value="{$contest['contest_id']}">

                <!-- 隐藏的假输入框，防止浏览器自动填充系统登录框的账号密码 -->
                <input type="text" name="contest_username_fake" autocomplete="off" tabindex="-1" aria-hidden="true" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
                <input type="password" name="contest_password_fake" autocomplete="new-password" tabindex="-1" aria-hidden="true" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">

                {if isset($team_id_bind) && $team_id_bind != null /}
                <div id="contest_passwordless_panel" class="contest-passwordless-panel mb-2">
                    <div class="alert alert-success mb-2 py-2 contest-passwordless-hint" role="status">
                        <i class="bi bi-pc-display-horizontal me-2"></i>
                        <span class="bilingual-inline">本机已绑定队伍 <strong>{$team_id_bind}</strong>，可直接免密登录<span class="en-text">This device is bound to team <strong>{$team_id_bind}</strong>. You can log in without a password.</span></span>
                    </div>
                    <div class="d-flex gap-2 flex-wrap align-items-center">
                        <button type="button" id="passwordless_login_btn" class="btn btn-success" title="本机已绑定账号，可以免密一键登录 / This device is bound to an account, you can log in with one click without password">免密登录<span class="en-text">Passwordless Login</span></button>
                        <button type="button" id="contest_show_password_login_btn" class="btn btn-outline-secondary btn-sm">密码登录<span class="en-text">Password Login</span></button>
                    </div>
                </div>
                {/if}

                <table id="contest_credential_table" class="exam-auth-table"{if isset($team_id_bind) && $team_id_bind != null /} style="display: none;"{/if}>
                    <tr id="contest_team_id_row">
                        <td class="label-cell">
                            <label for="cpc_team_id" class="form-label">队伍ID<span class="en-text">Team ID</span></label>
                        </td>
                        <td class="input-cell">
                            <input type="text" id="cpc_team_id" name="team_id" class="form-control" placeholder="队伍ID(Team ID)"{if !isset($team_id_bind) || $team_id_bind == null /} required autofocus{/if} autocomplete="off" data-bs-toggle="tooltip" data-bs-placement="top" title="" />
                        </td>
                    </tr>
                    <tr id="contest_password_row">
                        <td class="label-cell">
                            <label for="cpc_password" class="form-label">密码<span class="en-text">Password</span></label>
                        </td>
                        <td class="input-cell">
                            <input type="password" id="cpc_password" name="password" class="form-control" placeholder="密码(Password)"{if !isset($team_id_bind) || $team_id_bind == null /} required{/if} autocomplete="new-password" data-bs-toggle="tooltip" data-bs-placement="top" title="" />
                        </td>
                    </tr>
                    <tr>
                        <td class="label-cell"></td>
                        <td class="input-cell">
                            <div class="d-flex gap-2 flex-wrap align-items-center">
                                <button type="submit" id="submit_contest_logon_button" class="btn btn-primary">提交<span class="en-text">Submit</span></button>
                                {if isset($team_id_bind) && $team_id_bind != null /}
                                <button type="button" id="contest_back_passwordless_btn" class="btn btn-link btn-sm px-0" style="display: none;">返回免密登录<span class="en-text">Back to Passwordless</span></button>
                                {/if}
                            </div>
                        </td>
                    </tr>
                </table>
                <!-- 统一错误/提示区域：放在按钮下方 -->
                <div id="contest_auth_error_alert" class="mt-2 mb-0" style="display: none;"></div>
            </form>
        </div>
    {/if}
{/if}


