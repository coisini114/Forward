WidgetMetadata = {
  id: "gerenzuopin",
  title: "个人作品",
  version: "1.0.4",
  requiredVersion: "0.0.1",
  description: "获取 TMDB 个人相关作品数据",
  author: "Evan",
  site: "https://github.com/coisini114",
  cacheDuration: 172800,
  modules: [
    {
      id: "allWorks",
      title: "全部作品",
      functionName: "getAllWorks",
      cacheDuration: 172800,
      params: [
        {
          name: "personId",
          title: "个人ID",
          type: "input",
          description: "在 TMDB 网站获取的数字 ID",
        },
        { name: "language", title: "语言", type: "language", value: "zh-CN" },
        {
          name: "type",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "all" },
            { title: "电影", value: "movie" },
            { title: "电视剧", value: "tv" }
          ],
          value: "all"
        },
        {
          name: "sort_by",
          title: "排序方式",
          type: "enumeration",
          enumOptions: [
            { title: "发行日期降序", value: "release_date.desc" },
            { title: "评分降序", value: "vote_average.desc" },
            { title: "热门降序", value: "popularity.desc" }
          ],
          value: "popularity.desc"
        }
      ]
    },
    {
      id: "actorWorks",
      title: "演员作品",
      functionName: "getActorWorks",
      cacheDuration: 172800,
      params: []
    },
    {
      id: "directorWorks",
      title: "导演作品",
      functionName: "getDirectorWorks",
      cacheDuration: 172800,
      params: []
    },
    {
      id: "otherWorks",
      title: "其他作品",
      functionName: "getOtherWorks",
      cacheDuration: 172800,
      params: []
    }
  ]
};

// 复用 allWorks 参数到其他模块
["actorWorks", "directorWorks", "otherWorks"].forEach(id => {
  var module = WidgetMetadata.modules.find(m => m.id === id);
  module.params = JSON.parse(JSON.stringify(WidgetMetadata.modules[0].params));
});

// 基础获取TMDB人员作品方法,使用 combined_credits 接口
async function fetchCredits(personId, language) {
  var api = `person/${personId}/combined_credits`;
  var response = await Widget.tmdb.get(api, { params: { language: language || "zh-CN" } });
  if (!response || (!response.cast && !response.crew)) {
    throw new Error("获取作品数据失败");
  }

  var normalize = function(item) {
    return Object.assign({}, item, {
      mediaType: item.media_type,
      releaseDate: item.release_date || item.first_air_date
    });
  };

  return {
    cast: (response.cast || []).map(normalize),
    crew: (response.crew || []).map(normalize)
  };
}

// 过滤函数：按 mediaType 筛选
function filterByType(items, targetType) {
  return targetType === "all" ? items : items.filter(item => item.mediaType === targetType);
}

// 排序函数：根据 sort_by 参数排序
function applySorting(items, sortBy) {
  var sorted = items.slice();
  switch (sortBy) {
    case "vote_average.desc":
      sorted.sort(function(a, b) {
        return (b.vote_average || 0) - (a.vote_average || 0);
      });
      break;
    case "release_date.desc":
      sorted.sort(function(a, b) {
        return new Date(b.release_date || b.first_air_date) - new Date(a.release_date || a.first_air_date);
      });
      break;
    // popularity.desc 默认顺序已由 TMDB 返回
  }
  return sorted;
}

// 合并去重并格式化输出的通用函数
function formatResults(items) {
  var seen = {};
  var result = [];
  items.forEach(function(item) {
    if (!seen[item.id]) {
      seen[item.id] = true;
      result.push(item);
    }
  });
  return result.map(function(movie) {
    return {
      id: movie.id,
      type: "tmdb",
      title: movie.title || movie.name,
      description: movie.overview,
      releaseDate: movie.releaseDate,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      rating: movie.vote_average,
      mediaType: movie.mediaType
    };
  });
}

// 各模块函数
async function getAllWorks(params) {
  var p = params || {};
  var credits = await fetchCredits(p.personId, p.language);
  var list = credits.cast.concat(credits.crew);
  list = filterByType(list, p.type);
  list = applySorting(list, p.sort_by);
  return formatResults(list);
}
async function getActorWorks(params) {
  var p = params || {};
  var credits = await fetchCredits(p.personId, p.language);
  var list = credits.cast;
  list = filterByType(list, p.type);
  list = applySorting(list, p.sort_by);
  return formatResults(list);
}
async function getDirectorWorks(params) {
  var p = params || {};
  var credits = await fetchCredits(p.personId, p.language);
  var list = credits.crew.filter(function(item) {
    return item.job && item.job.toLowerCase().indexOf("director") !== -1;
  });
  list = filterByType(list, p.type);
  list = applySorting(list, p.sort_by);
  return formatResults(list);
}
async function getOtherWorks(params) {
  var p = params || {};
  var credits = await fetchCredits(p.personId, p.language);
  var list = credits.crew.filter(function(item) {
    var job = item.job && item.job.toLowerCase();
    return job && job.indexOf("director") === -1 && job.indexOf("actor") === -1;
  });
  list = filterByType(list, p.type);
  list = applySorting(list, p.sort_by);
  return formatResults(list);
}