document.getElementById("landingForm").addEventListener("submit",e=>{
  e.preventDefault();
  const v=document.getElementById("landingUrl").value;
  location.href="results.html?url="+encodeURIComponent(v);
});