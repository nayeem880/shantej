
$("#spider").change(function () {
    if ($(this).val() == "default") {
        $('#keywordsField').hide();
        $('#keywords').removeAttr('required');
        $('#keywords').removeAttr('data-error');

        $('#upload_csv').hide();
        $('#csv_file').removeAttr('required');
        $('#csv_file').removeAttr('data-error');

        $('#custom_report_name').hide();
        $('#report_name').removeAttr('required');
        $('#report_name').removeAttr('data-error');

        $('#browse_file').hide();
        $('#csv_file_name').removeAttr('required');
        $('#csv_file_name').removeAttr('data-error');
    } else if ($(this).val() == "guestpostscraper" || $(this).val() == "guestpostscraper_and_get_emails") {
        $('#keywordsField').show();
        $('#keywords').attr('required', '');
        $('#keywords').attr('data-error', 'This field is required.');

        $('#upload_csv').hide();
        $('#upload_csv_checkbox').removeAttr('required');
        $('#upload_csv_checkbox').removeAttr('data-error');

        $('#browse_file').hide();
        $('#csv_file_name').removeAttr('required');
        $('#csv_file_name').removeAttr('data-error');

        if ($(this).val() == "guestpostscraper_and_get_emails") {
            $('#custom_report_name').show();
            $('#report_name').attr('required', '');
            $('#report_name').attr('data-error', 'Please provide a report name.');
        } else {
            $('#custom_report_name').hide();
            $('#report_name').removeAttr('required');
            $('#report_name').removeAttr('data-error');
        }
    } else {
        $('#keywordsField').hide();
        $('#keywords').removeAttr('required');
        $('#keywords').removeAttr('data-error');

        $('#custom_report_name').show();

        $('#upload_csv').show();
        $('#upload_csv').change(function () {
            let cb = document.getElementById('upload_csv_checkbox')
            if (cb.checked) {
                $('#browse_file').show();
                $('#csv_file_name').attr('required', '');
                $('#csv_file_name').attr('data-error', 'Please upload a CSV file containing URLs.');
            } else {
                $('#browse_file').hide();
                $('#csv_file_name').removeAttr('required');
                $('#csv_file_name').removeAttr('data-error');
            }
        });
    }
});
$("#spider").trigger("change");


function exportTableToExcel(filename) {
    var downloadLink;
    var dataType = 'application/vnd.ms-excel';
    var tableSelect = document.getElementById('tblData');
    var tableHTML = tableSelect.outerHTML.replace(/ /g, '%20');

    // Specify file name
    filename = filename ? filename : 'excel_data.xls';

    // Create download link element
    downloadLink = document.createElement("a");

    document.body.appendChild(downloadLink);

    if (navigator.msSaveOrOpenBlob) {
        var blob = new Blob(['\ufeff', tableHTML], {
            type: dataType
        });
        navigator.msSaveOrOpenBlob(blob, filename);
    } else {
        // Create a link to the file
        downloadLink.href = 'data:' + dataType + ', ' + tableHTML;

        // Setting the file name
        downloadLink.download = filename;

        //triggering the function
        downloadLink.click();
    }
}

function downloadCsv(csv, filename) {
    var csvFile;
    var downloadLink;

    // CSV FILE
    csvFile = new Blob([csv], {
        type: "text/csv"
    });

    // Download link
    downloadLink = document.createElement("a");

    // File name
    downloadLink.download = filename;

    // We have to create a link to the file
    downloadLink.href = window.URL.createObjectURL(csvFile);

    // Make sure that the link is not displayed
    downloadLink.style.display = "none";

    // Add the link to your DOM
    document.body.appendChild(downloadLink);

    // Lanzamos
    downloadLink.click();
}

function exportTableToCsv(filename) {
    var csv = [];
    var rows = document.querySelectorAll("table tr");

    for (var i = 0; i < rows.length; i++) {
        var row = [],
            cols = rows[i].querySelectorAll("td, th");

        for (var j = 0; j < cols.length; j++)
            row.push(cols[j].innerText);

        csv.push(row.join(","));
    }

    // Download CSV
    downloadCsv(csv.join("\n"), filename);
}

// function exportTableToPdf(filename) {
//     html2canvas(document.getElementById('tblData'), {
//         onrendered: function (canvas) {
//             var data = canvas.toDataURL();
//             var docDefinition = {
//                 content: [{
//                     image: data,
//                     width: 500
//                 }]
//             };
//             pdfMake.createPdf(docDefinition).download(filename);
//         }
//     });
// }

function exportTableToPdf() {
    var sTable = document.getElementById('tblData').outerHTML;

    // CREATE A WINDOW OBJECT.
    var win = window.open('', '', 'height=700,width=700');
    win.document.write(sTable); // THE TABLE CONTENTS INSIDE THE BODY TAG.
    win.document.close(); // CLOSE THE CURRENT WINDOW.

    win.print(); // PRINT THE CONTENTS.
}

function sendMail() {
    let mailBody = document.getElementById('tblData').outerHTML;
    console.log(mailBody);
    window.location = "mailto:yourmail@domain.com?subject=hii&body=" + mailBody;
}

$("#to_email").change(function () {
    let to_email = $(this).val();
    let email_data = to_email.split('@');
    let subject = document.getElementById('email_subject').getAttribute("value");
    let new_subject = subject.replace('[domain of prospect]', email_data[1]);
    let body = document.getElementById('email_body').value;
    let new_body = body.replace('[domain of prospect]', email_data[1]);
    document.getElementById('email_subject').value = new_subject;
    document.getElementById('email_body').value = new_body;
});

$('select').change(function (evnt) {
    console.log($(this).attr("id"));
    evnt.preventDefault();
    let selectId = document.getElementById($(this).attr("id"));
    let selectOptions = selectId.options;
    let selectedOptionID = selectId.options[selectId.selectedIndex].id;

    Array.prototype.forEach.call(selectOptions, function (selectOption) {
        console.log('selectedOptionID - ' + selectedOptionID);
        console.log('selectOption.id - ' + selectOption.id);
        if (selectOption.id === selectedOptionID) {
            console.log('Match select');
            $('#' + selectedOptionID + "_subject").show();
            console.log('Subject displayed');
            $('#' + selectedOptionID + "_body").show();
            console.log('Body displayed');

            // let prev_email_subject = document.getElementById(selectedOptionID + "_email_subject").getAttribute('value');
            // let new_email_subject = prev_email_subject.replace('[domain of prospect]','MY DOMAIN');
            let email_subject = document.getElementById(selectedOptionID + "_email_subject").getAttribute('value');
            document.getElementById(selectedOptionID + "_email_subject").setAttribute('name', 'email_subject');
            // document.getElementById(selectedOptionID + "_email_subject").setAttribute('value', new_email_subject);
            document.getElementById(selectedOptionID + "_email_subject").setAttribute('value', email_subject);
            console.log('Subject name attrs set');
            console.log(document.getElementById(selectedOptionID + "_email_subject").getAttribute('value'));

            // let prev_email_body = document.getElementById(selectedOptionID + "_email_body").value;
            // let new_email_body = prev_email_body.replace('[domain of prospect]','MY DOMAIN');
            let email_body = document.getElementById(selectedOptionID + "_email_body").value;
            document.getElementById(selectedOptionID + "_email_body").setAttribute('name', 'email_body');
            // document.getElementById(selectedOptionID + "_email_body").setAttribute('value', new_email_body);
            document.getElementById(selectedOptionID + "_email_body").setAttribute('value', email_body);
            console.log('Body name attr set');
            console.log(document.getElementById(selectedOptionID + "_email_body").getAttribute('value'));
        } else {
            $('#' + selectOption.id + "_subject").hide();
            $('#' + selectOption.id + "_subject").removeAttr('required');
            $('#' + selectOption.id + "_subject").removeAttr('data-error');

            $('#' + selectOption.id + "_body").hide();
            $('#' + selectOption.id + "_body").removeAttr('required');
            $('#' + selectOption.id + "_body").removeAttr('data-error');
        }
    });
});

// Select All Email Reports
$("#checkAll").click(function () {
    $(".check").prop('checked', $(this).prop('checked'));
});

// Code to update /view titles in place
let previousRerportTitle = '';

function getReportTitle(html) {
    previousRerportTitle = html.innerText;
}

function updateReportTitle(html) {
    console.log(previousRerportTitle);
    console.log(html.innerText);
    $.ajax({
        url: '/updateReportTitle',
        type: 'POST',
        async: false,
        contentType: 'application/json',
        data: JSON.stringify({
            previousTitle: previousRerportTitle,
            newTitle: html.innerText
        }),
        success: function (res) {
            console.log('Successfully updated report title');
        },
        error: function (err) {
            console.log(err);
        }
    });
}

// Code to update /reports titles in place
let previousKeywordTitle = '';

function getKeywordTitle(html) {
    previousKeywordTitle = html.innerText;
}

function updateKeywordsTitle(html) {
    console.log(previousKeywordTitle);
    console.log(html.innerText);
    $.ajax({
        url: '/updateKeywordsTitle',
        type: 'POST',
        async: false,
        contentType: 'application/json',
        data: JSON.stringify({
            previousTitle: previousKeywordTitle,
            newTitle: html.innerText
        }),
        success: function (res) {
            console.log('Successfully updated keyword title');
        },
        error: function (err) {
            console.log(err);
        }
    });
}

// Code to show spinner
function showSpinner() {
    $("#spinner").style.display = 'block';
}

// Code to hide spinner
function hideSpinner() {
    $("#spinner").style.display = 'none';
}

// Get selected row emails
function getSelectedEmails() {
    //Reference the Table.
    const grid = document.getElementById("tblData");

    //Reference the CheckBoxes in Table.
    const checkBoxes = grid.getElementsByTagName("input");
    let emails = [];

    //Loop through the CheckBoxes.
    for (var i = 0; i < checkBoxes.length; i++) {
        if (checkBoxes[i].checked) {
            let row = checkBoxes[i].parentNode.parentNode;
            let email = row.cells[4].innerText;
            if (email !== "Email") {
                emails.push(row.cells[4].innerText);
            }
        }
    }

    //Display selected Row data in Alert Box.
    console.log(emails);
    document.getElementById("to_email").value = emails;
}