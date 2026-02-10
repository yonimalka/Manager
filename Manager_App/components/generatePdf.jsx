import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

export const generatePDF = async (payload) => {
//   const { materialsList, toDoList } = project;
    const  project = payload.data.name;
  // Detect available tables
  let hasTasks;
  let hasMaterials;
  if (payload.type === "tasks") {
    hasTasks = payload.data.list;
    // console.log(hasTasks);
    
  }
  if (payload.type === "materials") {
     hasMaterials = payload.data.list;
    //  console.log(hasMaterials);
     
  }
 
  

  // Function to build an HTML table dynamically
  const buildTable = (title, headers, rows) => {
    return `
      <h3 style="margin-top: 24px;">${title}</h3>
      <table>
        <tr>
          ${headers.map(h => `<th>${h}</th>`).join("")}
        </tr>
        ${rows
          .map(row => `
            <tr>
              ${row.map(col => `<td>${col}</td>`).join("")}
            </tr>
        `)
        .join("")}
      </table>
    `;
  };

  // Build Materials table if exists
  const materialsTable = hasMaterials
    ? buildTable(
        "Materials List",
        ["Item", "Qty"],
        hasMaterials.map(m => [m.item, m.qty])
      )
    : "";

  // Build Tasks table if exists
  const tasksTable = hasTasks
    ? buildTable(
        "Task List",
        ["Task", "Details", "Status"],
        hasTasks.map(t => [
          t.task,
          t.details,
          t.checked ? "✔" : "✘"
        ])
      )
    : "";

  // MAIN HTML DOCUMENT
  const html = `
    <html dir="ltr" lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 24px;
            color: #1e293b;
          }
          h1 {
            text-align: center;
            margin-bottom: 60px;
            color: #065f46;
          }
          h3 {
            color: #064e3b;
            border-left: 4px solid #10b981;
            padding-left: 10px;
            margin-bottom: 60px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 15px;
          }
          th {
            background: #d1fae5;
            padding: 10px;
            border: 1px solid #000;
          }
          td {
            padding: 10px;
            border: 1px solid #888;
          }
          tr:nth-child(even) td {
            background-color: #f0fdf4;
          }
          .section {
            margin-top: 30px;
            font-size: 17px;
          }
        </style>
      </head>
       
      <body>
      <div class="section">
          <strong>Project Name:</strong> ${project} <br>
        </div>
        ${tasksTable}
        ${materialsTable}
        

      </body>
    </html>
  `;
  
  
  // Generate PDF
  const { uri } = await Print.printToFileAsync({ html });

 const newUri = `${FileSystem.documentDirectory}Project-${project}.pdf`;

  // 3️⃣ Move (rename) the file
  await FileSystem.moveAsync({
    from: uri,
    to: newUri,
  });

  // 4️⃣ Share the renamed file
  await Sharing.shareAsync(newUri);
};
