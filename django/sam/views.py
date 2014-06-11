from django.contrib.auth.decorators import login_required
from splunkdj.decorators.render import render_to

@render_to('sam:home.html')
@login_required
def home(request):
    return {
        # Insert custom variables for the view here
    }

# Insert additional view functions here