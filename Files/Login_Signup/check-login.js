/* Function used to remove the error div */
function setInvisible()
{ document.getElementById("errorMessage").remove(); } // Delete the error message

/* Function used to add red border to the specified div */
function addRedBorder(id)
{
  $("#" + id).css("border-color", "rgba(200, 37, 37, 0.9)"); // Add red border 
  $("#" + id).css("border-width", "2px");
}

/* Function used to generate the error div */
function generateErrorDiv(errorMessage)
{
  // If there is at least one error
  if (document.getElementById("errorMessage") == null) 
  {
    // If the element does not exist, create it
    document
      .getElementById("form")
      .insertAdjacentHTML(
        "afterbegin",
        '<div class="alert alert-danger d-flex align-items-end alert-dismissible" id="errorMessage" style="height: fit-content"></div>'
      );
  }
  $("#errorMessage").html(
    "<strong class=\'mx-2\'>Error! <br>" +
      errorMessage +
      "</strong><button type=\'button\' class=\'btn-close\' onclick=\'setInvisible()\'></button>"
  ); // Add the element into the HTML
}

/* Function used to check if the values insert are correct or not */
async function check() 
{
  var errorMessage = ""; //Error

  if ($("#password").val() == "") 
  {
    // If the password is empty
    addRedBorder("password");
    errorMessage = "Please, insert the password";
  }

  if ($("#email").val() == "") 
  {
    // If the email is empty
    addRedBorder("email");
    errorMessage = "Please, insert the email";
  }

  if (errorMessage != "") 
  {
    generateErrorDiv(errorMessage)
    return false;
  }

  const email = $("#email").val();
  const password = $("#password").val();

  try // Send AJAX query to the server
  {
    const response = await fetch("/login", 
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    if (response.ok) // The credentials are correct
    { window.location = "/game"; } 
    else // The credentials are not correct
    { generateErrorDiv(await response.text()); }
  } 
  catch (error) 
  {
    console.error("Error:", error);
    return false;
  }
}