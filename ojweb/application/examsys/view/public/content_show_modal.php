<!-- Modal -->
<div class="modal fade" id="content_show_modal" tabindex="-1" role="dialog" aria-labelledby="content_show_modal_label" aria-hidden="true">
    <div class="modal-dialog modal-lg" >
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">
                    <span id="content_show_modal_label_span">Code Info</span> &nbsp;&nbsp;
                    <button type="button" class="btn btn-sm btn-success content_show_modal_copy" style="min-width: 100px;" data-clipboard-target="#content_show_to_copy">Copy</button>
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"  aria-label="Close"></button>
            </div>
            <div class="modal-body" id="content_show_modal_content">
                ...
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-success content_show_modal_copy" data-clipboard-target="#content_show_to_copy">Copy</button>
                <button type="button" class="btn btn-info" data-bs-dismiss="modal">Cool!</button>
            </div>
        </div>
    </div>
</div>
<script>
var content_show_modal = $('#content_show_modal');
var content_show_modal_label = $('#content_show_modal_label');
var content_show_modal_content = $('#content_show_modal_content');
var content_show_modal_label_span = $('#content_show_modal_label_span');
</script>