const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);

async function check()
{
    var errorMessage = ""; //Error

    if($("#password").val() == "") // If the password is empty
    { 
        addRedBorder("password")
        errorMessage = "Please, insert the password"; 
    }

    if($("#email").val() == "") // If the email is empty
    { 
        addRedBorder("email")
        errorMessage = "Please, insert the email"; 
    }

    if(errorMessage != "") // If there is at least one error
    { 
        if(document.getElementById("errorMessage") == null) // If the element does not exist, create it
        { document.getElementById("form").insertAdjacentHTML("afterbegin", '<div class="alert alert-danger d-flex align-items-end alert-dismissible" id="errorMessage" style="height: fit-content"></div>'); }
        $("#errorMessage").html("<strong class=\'mx-2\'>Error! <br>" + errorMessage + "</strong><button type=\'button\' class=\'btn-close\' onclick=\'setInvisible()\'></button>"); // Add the element into the HTML 
        return false;
    }

    const email = $('#email').val()
    const password = $('#password').val()
    
    socket.send(JSON.stringify({ type:'login', email: email, password: password }));
  
    const data = await waitForMessage(socket);
    console.log('Message received:', data);

    return true;   
}

function setInvisible()
{ document.getElementById("errorMessage").remove(); } // Delete the error message

function addRedBorder(id)
{
  $("#" + id).css("border-color", "rgba(200, 37, 37, 0.9)"); // Add red border 
  $("#" + id).css("border-width", "2px");
}

function waitForMessage(socket) 
{
  return new Promise((resolve) => 
  {
    socket.addEventListener('message', (event) => 
    {
      const data = JSON.parse(event.data);
      console.log("Receiving messages from server " + data.email);
      sessionStorage.setItem('email', data.email);
      sessionStorage.setItem('username', data.username);
  
      resolve(data);
    });
  });
}