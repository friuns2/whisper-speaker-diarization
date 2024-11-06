<script>
  export let text;
  export let percentage;
  export let total;
</script>

<div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
  <div
    class="bg-blue-600 h-2.5 rounded-full"
    style="width: {percentage}%"
  ></div>
</div>
<p class="text-xs text-gray-600 dark:text-gray-400">{text} ({percentage}/{total})</p>
