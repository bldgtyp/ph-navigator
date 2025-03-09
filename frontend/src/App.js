import { useState, useEffect } from "react";
import axios from "axios";

function App() {
  const [data, setData] = useState([]);

  useEffect(() => {
    // axios.get("http://localhost:8000/data")
    axios.get("https://ph-dash-0cye.onrender.com/data")
      .then(response => setData(response.data || []))
      .catch(error => console.error("Error fetching data:", error));
  }, []);

  return (
    <div>
      <h1>Airtable Data</h1>
      <table border="1">
        <thead>
          <tr>
            <th>ID</th>
            <th>Created Time</th>
            <th>Category</th>
            <th>Missing Datasheets?</th>
            <th>Missing Specs?</th>
          </tr>
        </thead>
        <tbody>
          {data.map(record => (
            console.log(record),
            <tr key={record.id}>
              <td>{record.id}</td>
              <td>{record.createdTime}</td>
              <td>{record.fields.CATEGORY}</td>
              <td>{record.fields.MISSING_DATASHEETS}</td>
              <td>{record.fields.MISSING_SPECS}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
