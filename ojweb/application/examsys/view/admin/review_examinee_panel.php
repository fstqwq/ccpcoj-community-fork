<div id="review_examinee_table_div">
    <div class="p-2 border-bottom bg-light">
        <strong>考生列表 / Examinee List</strong>
    </div>
    <table
        id="review_examinee_table"
        data-toggle="table"
        data-unique-id="team_id"
        data-buttons-align="right"
        data-side-pagination="client"
        data-url="/{$module}/admin/teamgen_list_ajax?cid={$contest['contest_id']}"
        data-pagination="false"
        data-method="get"
        data-fixed-columns=true
        data-fixed-number=2
        data-row-style="RowStyle"
        data-classes="table table-sm table-hover"
    >
        <thead>
        <tr>
            <th data-field="idx" data-align="center" data-valign="middle" data-width="40" data-formatter="FormatterIdx" title="序号 / Index">#</th>
            <th data-field="team_id" data-align="left" data-valign="middle" data-formatter="FormatterExaminee" title="账号 / ID">账号/ID</th>
            <th data-field="name" data-align="left" data-valign="middle" data-width="80" data-formatter="FormatterName" title="姓名 / Name">姓名</th>
            <th data-field="score" data-align="center" data-valign="middle" data-width="70" data-formatter="FormatterExamineeScore" title="总分 / Score">总分</th>
        </tr>
        </thead>
    </table>
</div>
