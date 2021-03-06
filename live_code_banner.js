/*global hljs*/

let fetch_json = uri => fetch(uri).then(response => response.json());

const code_file_types = ['js', 'java', 'html'];

let get_random_value = from_array => from_array[Math.round(Math.random() * (from_array.length - 1))];

let fetch_repository_names = async username => fetch_json(`https://api.github.com/users/${username}/repos`)
  .then(response => response.map(repository => repository.name));

let fetch_latest_commit_sha = async (username, repository) => fetch_json(`https://api.github.com/repos/${username}/${repository}/commits`)
  .then(commits => commits[0].sha); // 0 idx isn't actually confirmed to be latest

let fetch_code_file_paths_from_repository = async (username, repository, latest_commit_sha) => fetch_json(`https://api.github.com/repos/${username}/${repository}/git/trees/${latest_commit_sha}?recursive=1`)
  .then(trees => trees.tree)
  // TODO would be nice to filter out dotfiles/configs as well
  .then(files => files.filter(file => file.type === 'blob' && !file.path.includes('test')
    && code_file_types.filter(type => file.path.endsWith(type)).length > 0))
  .then(code_files => code_files.map(code_file => code_file.path));

let fetch_code = async uri => fetch(uri).then(response => response.text());

let start_fetching_code = async (username, repository, on_code_loaded) => {
  let all_repository_names = repository ? [repository] : await fetch_repository_names(username);
  let current_repository_name;
  let current_repository_code_file_paths = [];
  let current_repository_latest_commit_sha = [];

  let load_random_code = async () => {
    if(current_repository_name && current_repository_code_file_paths.length > 0) {
      console.log(`${current_repository_name} has ${current_repository_code_file_paths.length} code files left to display`);

      let random_code_file_path = get_random_value(current_repository_code_file_paths);

      let code_file_name = random_code_file_path.substring(random_code_file_path.lastIndexOf('/') + 1);

      let code_file_raw_url = `https://raw.githubusercontent.com/${username}/${current_repository_name}/${current_repository_latest_commit_sha}/${random_code_file_path}`;

      let code_file_blob_url = `https://github.com/${username}/${current_repository_name}/blob/${current_repository_latest_commit_sha}/${random_code_file_path}`;

      console.log(`Fetching ${code_file_raw_url}..`);

      let code = await fetch_code(code_file_raw_url);

      current_repository_code_file_paths.splice(current_repository_code_file_paths.indexOf(random_code_file_path), 1); // Remove from array so it isn't chosen again

      // Here: remove the value from code_files, and it and code to a separate []/map ~ cached_code_files
      // This will prevent showing duplicates until there are no files remaining, then cached_code_files can be used

      // Would be cool to supply what the repo / file is and URL to display anchor in banner
      on_code_loaded(username, code, code_file_name, current_repository_name, code_file_blob_url);

      let get_random_duration_between = (start_range, end_range) => Math.floor(Math.random() * (end_range - start_range + 1) + start_range);

      let random_duration = get_random_duration_between(7500, 25000);

      setTimeout(load_random_code, random_duration);

    }
    else if(all_repository_names.length > 0) {
      current_repository_name = get_random_value(all_repository_names);
      all_repository_names.splice(all_repository_names.indexOf(current_repository_name), 1); // Remove from array so it isn't chosen again
      
      console.log(`There are ${all_repository_names.length} repositories remaining`);

      console.log('Fetching latest commit SHA..');
      current_repository_latest_commit_sha = await fetch_latest_commit_sha(username, current_repository_name);
      console.log(`Fetched ${current_repository_latest_commit_sha}.`);

      console.log('Fetching code file paths..');
      current_repository_code_file_paths = await fetch_code_file_paths_from_repository(username, current_repository_name, current_repository_latest_commit_sha);
      console.log(`Fetched ${current_repository_code_file_paths.length} code file paths.`);

      load_random_code();
    }
    else {
      console.log('There are no repositories left to show');
    }
  };

  load_random_code();
};

let get_banner_container_elements = () => Array.from(document.getElementsByClassName('live_code_banner_container'));

let create_banner = (for_container) => {

  let username = for_container.getAttribute('for-username');
  let repository = for_container.getAttribute('for-repository');

  if(username) {

    console.log('Creating banner for username: ', username);

    !for_container.style.position && (for_container.style.position = 'relative'); // TODO not sure how absolute/fixed behaves, might need to inception the container wrapping once or twice more

    let scroll_speed_ms = parseInt(for_container.getAttribute('scroll-speed-ms'));
    scroll_speed_ms = isNaN(scroll_speed_ms) ? 25 : scroll_speed_ms; // Make attr optional

    let scroll_speed_step_px = parseFloat(for_container.getAttribute('scroll-speed-step-px'));
    scroll_speed_step_px = isNaN(scroll_speed_step_px) ? .5 : scroll_speed_step_px; // Make attr optional
  
    let banner = {};

    let create_elements = () => {
      let $new = e => document.createElement(e);
      banner.viewport = $new('div');
      banner.overlay = $new('div');
      banner.code_pre = $new('pre');
      banner.username_anchor = $new('a');
      banner.code_file_name_anchor = $new('a');

      banner.code_pre.set_y = px => (banner.code_pre.style.top = `${px}px`);
      banner.viewport.get_scroll_bounds_y = () => -1 * banner.code_pre.getBoundingClientRect().height + banner.viewport.getBoundingClientRect().height;
      window.addEventListener('resize', () => banner.is_done_scrolling && banner.code_pre.set_y(banner.viewport.get_scroll_bounds_y()));
    };

    let style_elements = () => {
      for_container.style.position = 'relative';
      banner.overlay.style.position = banner.viewport.style.position = 'absolute';
      banner.overlay.style.top = banner.viewport.style.top = '0px';
      banner.overlay.style.bottom = banner.viewport.style.bottom = '0px';
      banner.overlay.style.left = banner.viewport.style.left = '0px';
      banner.overlay.style.right = banner.viewport.style.right = '0px';
      banner.overlay.style.pointerEvents = 'none'; // Allow for interaction of elements under overlay
      banner.overlay.style.background = 'linear-gradient(0deg, rgba(0, 0, 0, 0.5) 0%, rgba(61, 61, 61, 0.2) 10%, rgba(187, 187, 187, 0.15) 50%, rgba(61, 61, 61, 0.2) 90%, rgba(0, 0, 0, 0.5) 100%)';

      banner.viewport.style.overflow = 'hidden';
      banner.viewport.style.backgroundColor = '#272822';

      banner.code_pre.className = 'code_pre';
      banner.code_pre.style.margin = '0px';
      banner.code_pre.style.transformOrigin = 'top left';
      banner.code_pre.style.transform = 'translateZ(0)';
      banner.code_pre.style.width = '200%';
      banner.code_pre.style.position = 'absolute';
      banner.code_pre.style.overflow = 'hidden';

      banner.username_anchor.className = 'username_anchor'; // Allows for overrides
      banner.username_anchor.style.position = 'absolute';
      banner.username_anchor.style.right = '5px';
      banner.username_anchor.style.top = '5px';
      banner.username_anchor.style.color = '#FFF';
      banner.username_anchor.style.backgroundColor = '#000A';
      banner.username_anchor.style.padding = '2px';
      banner.username_anchor.style.borderRadius = '3px';

      banner.code_file_name_anchor.className = 'code_file_name_anchor'; // Allows for overrides
      banner.code_file_name_anchor.style.position = 'absolute';
      banner.code_file_name_anchor.style.right = '5px';
      banner.code_file_name_anchor.style.bottom = '5px';
      banner.code_file_name_anchor.style.color = '#FFF';
      banner.code_file_name_anchor.style.backgroundColor = '#000A';
      banner.code_file_name_anchor.style.padding = '2px';
      banner.code_file_name_anchor.style.borderRadius = '3px';
    };

    let append_elements = () => {
      banner.viewport.appendChild(banner.code_pre);
      banner.viewport.appendChild(banner.username_anchor);
      banner.viewport.appendChild(banner.code_file_name_anchor);
      for_container.appendChild(banner.viewport);
      for_container.appendChild(banner.overlay);
    };

    create_elements();
    style_elements();
    append_elements();

    banner.start_fetching_code = () => {
      start_fetching_code(username, repository, banner.start_scrolling);
    };

    banner.set_info = (username, code, code_file_name, repo_name, code_file_blob_url) => {
      banner.username_anchor.textContent = `@${username}`;
      banner.username_anchor.href = `https://github.com/${username}`;

      banner.code_file_name_anchor.textContent = `${repo_name} - ${code_file_name}`;
      banner.code_file_name_anchor.href = code_file_blob_url;

      banner.code_pre.textContent = code;
      hljs.highlightBlock(banner.code_pre);
    };

    banner.scroll_interval;
    banner.is_done_scrolling;
    banner.start_scrolling = (username, code, code_file_name, repo_name, code_file_blob_url) => {
      console.log(`Banner is displaying ${code_file_name} from ${repo_name} at ${code_file_blob_url} by ${username}`);
      
      banner.set_info(username, code, code_file_name, repo_name, code_file_blob_url);

      banner.is_done_scrolling = false;
      banner.scroll_interval && clearInterval(banner.scroll_interval);

      let get_random_start_point_y = () => -1 * banner.code_pre.getBoundingClientRect().height / 3 * Math.random();

      let start_scroll_y = get_random_start_point_y();
      banner.code_pre.set_y(start_scroll_y);


      banner.scroll_interval = setInterval(() => {
        let is_in_bounds_y = banner.code_pre.getBoundingClientRect().y > banner.viewport.get_scroll_bounds_y();

        if(is_in_bounds_y) {
          banner.code_pre.set_y(start_scroll_y -= scroll_speed_step_px);
        }
        else {
          // Would be nice to force new code fetch here since scroll duration can exceed file length (user is looking at EOF in that situation)
          clearInterval(banner.scroll_interval);
          banner.is_done_scrolling = true;
        }
      }, scroll_speed_ms);
    };

    return banner;

  }
  else {
    throw 'Target github username must be specified in for-username attribute of live_code_banner_container element';
  }
};

window.addEventListener('DOMContentLoaded', () => {
  get_banner_container_elements().forEach(container => {
    let banner = create_banner(container);
    banner.start_fetching_code();
  });
});